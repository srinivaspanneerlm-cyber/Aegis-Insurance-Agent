"""
Aegis AI — the tee between an LLM call and the SSE stream.

The advisor's reply has always been produced in one piece and then replayed to
the browser two words at a time, on a timer. That is not streaming; it is an
animation of something that already finished. The customer waits the entire
generation before the first word appears, and in voice they wait it in silence,
which reads as the advisor having hung up.

Making it real is complicated by where the reply is assembled. The LLM call sits
six frames down — `stream_service` → `CentralOrchestrator.dispatch` →
`AgentEnvironment` → `BaseInsuranceAgent.respond` → `generate_response` →
`LLMService` — and threading a callback through all of that would mean changing
the signature of every protected boundary in the system to carry a parameter
only one caller in the tree ever uses.

So the sink travels by context instead. `stream_service` puts one in the context
before it creates the orchestrator task; `asyncio.create_task` copies the
context, so the task and everything it awaits can find it. Nothing in between
knows it exists, and no signature changes.

Three properties make this safe rather than merely convenient:

  **Disarmed by default.** A sink that exists is not a sink that is used.
  Exactly one caller arms it — `BaseInsuranceAgent.generate_response`, and only
  on turns where the whole-reply guardrails provably cannot rewrite what the
  model wrote. Every other LLM call in the codebase, including the executive
  agent's direct one, sees an unarmed sink and behaves exactly as before.

  **A tee, not a redirect.** `generate_response` still returns the complete
  string, so the recommendation embedder, the plan withholding rule, the
  response cleaner and `_after_turn` all run on the whole reply, unchanged and
  in the same order. Streaming is something that happened on the way past.

  **Reconcilable.** The sink remembers exactly what it released. The final reply
  is compared against that, so the difference between "stream the rest" and "the
  turn diverged and the customer must be shown something else" is a fact, not an
  assumption.
"""

from __future__ import annotations

import asyncio
from contextvars import ContextVar
from typing import AsyncGenerator, List, Optional

from app.utils.logger import logger

# The sentinel that ends a drain. A unique object rather than None, because None
# is a legitimate thing to fail to produce.
_END = object()


class TokenSink:
    """
    Somewhere for tokens to go while the turn is still being assembled.

    One per streamed request. Not thread-safe and not meant to be: it lives
    inside a single asyncio task tree.
    """

    def __init__(self, max_queue: int = 512) -> None:
        # Bounded, and dropped from rather than blocked on. A slow browser must
        # not be able to stall the LLM call feeding it — the reply is still
        # delivered whole at the end, so a dropped token costs nothing but the
        # animation, while a blocked generator would cost the turn.
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue)
        self._armed = False
        self._closed = False
        self._dropped = 0

        # What was actually released, in order. The authority for reconciliation.
        self._released: List[str] = []

        # Who is speaking, known as soon as the sink is armed — which is well
        # before `dispatch` returns the metadata. It is what lets the browser
        # show the right advisor's name against the first token instead of
        # holding every token back until the turn is otherwise complete.
        self.agent_name: Optional[str] = None
        self.agent_domain: Optional[str] = None

        # Line-start filtering, mirroring `BaseInsuranceAgent._clean_response`.
        # Without it the streamed text and the final text disagree whenever the
        # model emits one of the scaffolding headers, and the customer sees a
        # line appear and then vanish.
        self._strip_prefixes: tuple = ()
        self._max_prefix = 0
        self._line_head = ""
        self._line_open = False
        self._line_suppressed = False

    # ── Arming ────────────────────────────────────────────────────────────────

    @property
    def is_armed(self) -> bool:
        return self._armed and not self._closed

    def arm(
        self,
        agent_name: Optional[str] = None,
        agent_domain: Optional[str] = None,
        strip_prefixes: Optional[List[str]] = None,
    ) -> None:
        """
        Permit tokens to flow.

        Called only from the one place that can prove the whole-reply guardrails
        are a no-op for this turn. `strip_prefixes` is the caller's own header
        list, passed in rather than duplicated here so the two cannot drift.
        """
        self._armed = True
        self.agent_name = agent_name or self.agent_name
        self.agent_domain = agent_domain or self.agent_domain
        self._strip_prefixes = tuple(strip_prefixes or ())
        self._max_prefix = max((len(p) for p in self._strip_prefixes), default=0)

    def disarm(self) -> None:
        """Stop permitting tokens. Anything held in the line buffer is dropped —
        it was never released, so nothing downstream has to unsee it."""
        self._armed = False
        self._line_head = ""
        self._line_open = False
        self._line_suppressed = False

    # ── Writing ───────────────────────────────────────────────────────────────

    def emit(self, text: str) -> None:
        """
        Offer a chunk of model output.

        Silently ignored when the sink is not armed, which is what makes this
        safe to call unconditionally from the provider loop.
        """
        if not text or not self.is_armed:
            return
        for piece in self._filter(text):
            self._put(piece)

    def _put(self, text: str) -> None:
        if not text:
            return
        try:
            self._queue.put_nowait(text)
        except asyncio.QueueFull:
            # Counted, not raised. See the note on the queue bound above.
            self._dropped += 1
            return
        self._released.append(text)

    def _filter(self, text: str):
        """
        Withhold a scaffolding line, and only a scaffolding line.

        A line is judged by its first characters, so the decision needs at most
        `_max_prefix` of them — after that the rest of the line flows freely.
        The alternative, holding every line until its newline arrives, would
        stall the first sentence behind the whole paragraph and give back the
        latency this exists to win.
        """
        if not self._strip_prefixes:
            yield text
            return

        for chunk in text.splitlines(keepends=True):
            ends_line = chunk.endswith("\n")
            body = chunk[:-1] if ends_line else chunk

            if not self._line_open:
                self._line_open = True
                self._line_head = ""
                self._line_suppressed = False

            if self._line_suppressed:
                if ends_line:
                    self._line_open = False
                continue

            # `None` means "this line is already decided — pass the rest of it
            # through untouched". Distinct from `""`, which means "a new line
            # has started and nothing has been judged yet".
            if self._line_head is not None and len(self._line_head) < self._max_prefix:
                self._line_head += body
                stripped = self._line_head.lstrip()

                if any(stripped.startswith(p) for p in self._strip_prefixes):
                    # Nothing of this line has been released yet, so suppressing
                    # it now is invisible rather than a correction.
                    self._line_suppressed = True
                    if ends_line:
                        self._line_open = False
                    continue

                # Undecided: could still become a header once more arrives.
                if len(self._line_head) < self._max_prefix and not ends_line:
                    if any(p.lstrip().startswith(stripped) for p in self._strip_prefixes if stripped):
                        continue

                out = self._line_head
                self._line_head = None
                yield out + ("\n" if ends_line else "")
                if ends_line:
                    self._line_open = False
                continue

            yield chunk
            if ends_line:
                self._line_open = False
                self._line_head = ""

    def flush_line_buffer(self) -> None:
        """Release anything held back for a header decision that never came.

        A reply whose final line is shorter than the longest header prefix would
        otherwise end with those characters stuck in the buffer — text the
        customer never sees, for a header it never was.
        """
        if self._line_head and not self._line_suppressed:
            self._put(self._line_head)
        self._line_head = ""
        self._line_open = False
        self._line_suppressed = False

    def close(self) -> None:
        """No more tokens. Wakes a drain that is waiting."""
        if self._closed:
            return
        self.flush_line_buffer()
        self._closed = True
        self._armed = False
        try:
            self._queue.put_nowait(_END)
        except asyncio.QueueFull:
            # The drain reads until it sees `_END`; if the queue is full it is
            # also being read, so the sentinel lands on the next attempt below.
            logger.warning("[TokenSink] queue full while closing — draining will end on the reader's timeout")

    # ── Reading ───────────────────────────────────────────────────────────────

    @property
    def released(self) -> str:
        """Exactly what the browser has been shown, in order."""
        return "".join(self._released)

    @property
    def dropped(self) -> int:
        return self._dropped

    @property
    def has_released(self) -> bool:
        return bool(self._released)

    async def drain(self) -> AsyncGenerator[str, None]:
        """Yield chunks as they arrive, ending when `close()` is called."""
        while True:
            item = await self._queue.get()
            if item is _END:
                return
            yield item

    def reconcile(self, final_reply: str) -> Optional[str]:
        """
        What still needs sending, given what was already released.

        Returns the remaining text when the final reply extends what the
        customer already has — the ordinary case, where the tail is the
        recommendation card the embedder appended. Returns `None` when the reply
        diverged and the released text is no longer true, which happens when the
        LLM failed part-way through and the agent answered with its own fallback
        instead. The caller has to correct the screen in that case; it is not a
        difference that can be papered over with more tokens.
        """
        released = self.released
        if not released:
            return final_reply
        if final_reply.startswith(released):
            return final_reply[len(released):]
        # Whitespace at the seam is not divergence: the cleaner strips the
        # reply's ends, so a trailing space that was streamed legitimately
        # disappears from the final text.
        if final_reply.startswith(released.rstrip()) and released.strip():
            return final_reply[len(released.rstrip()):]
        return None


# ── The context slot ──────────────────────────────────────────────────────────

_sink: ContextVar[Optional[TokenSink]] = ContextVar("aegis_token_sink", default=None)


def set_sink(sink: Optional[TokenSink]) -> None:
    """Install the sink for this context and everything spawned from it."""
    _sink.set(sink)


def current_sink() -> Optional[TokenSink]:
    """The sink for this request, if one was installed. Never raises."""
    try:
        return _sink.get()
    except LookupError:
        return None


def emit_token(text: str) -> None:
    """Offer a chunk to whatever sink is listening. A no-op when none is."""
    sink = current_sink()
    if sink is not None:
        sink.emit(text)


def streaming_wanted() -> bool:
    """Whether anything is listening and armed — i.e. whether it is worth asking
    the provider for a token stream at all."""
    sink = current_sink()
    return sink is not None and sink.is_armed
