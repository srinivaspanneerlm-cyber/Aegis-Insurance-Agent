"""
Aegis AI — SSE Streaming Service

Runs the orchestrator in parallel with animated thinking steps and streams the
reply as the model writes it.

"As the model writes it" is new, and is the whole point. This used to await
`dispatch()` to completion and then replay the finished reply two words at a
time on a 25ms timer — an animation of something that had already happened. The
customer waited out the entire generation before the first word appeared, and on
the voice path they waited it in silence, which does not read as thinking; it
reads as the advisor having hung up.

Now the tokens are real. A `TokenSink` is placed in the context before the
orchestrator task is created, the task inherits it, and the LLM call six frames
down emits into it while it generates. Nothing between here and there changed
shape — see `app/services/token_stream.py` for why it travels by context rather
than by parameter.

Two things this deliberately does not do:

  It does not stream every turn. The sink is armed only where the whole-reply
  guardrails provably cannot rewrite the model's words — `BaseInsuranceAgent`
  decides, and on a turn where the consultation is still incomplete it refuses.
  Those turns take the buffered path below, byte for byte as before.

  It does not trust the stream over the turn. `dispatch()` still returns the
  authoritative reply, and what was released is reconciled against it: the
  ordinary case appends the tail, and a genuine divergence — an LLM that died
  half-way and was answered by the agent's own fallback — corrects the screen
  with `replace` rather than leaving something untrue on it.

SSE event types:
  { type: "thinking",   step: str, label: str }
  { type: "agent_info", agent_name, agent_domain, transferred, transfer_from,
                        transfer_to, transfer_to_name, session_id }
  { type: "token",      text: str }
  { type: "replace",    text: str }   # the turn diverged; this is the truth
  { type: "done",       session_id: str, latency: {...} }
  { type: "error",      message: str }
"""

import asyncio
import json
import re
import time
from typing import AsyncGenerator, Dict, List, Optional, Any, Tuple

from app.orchestrator.central_orchestrator import CentralOrchestrator
from app.services.token_stream import TokenSink, set_sink
from app.services.voice_context import build_voice_context, set_voice_context
from app.utils.logger import logger

# ─── Singleton orchestrator (shared session state via SessionManager class var) ──
_orchestrator = CentralOrchestrator()

# ─── Domain-aware thinking step sequences ────────────────────────────────────────
THINKING_STEPS: Dict[str, List[tuple]] = {
    "health": [
        ("intent",    "Understanding your health insurance needs..."),
        ("profile",   "Reviewing your family profile..."),
        ("options",   "Finding the best health plans for you..."),
        ("premium",   "Calculating the right premium range..."),
        ("rec",       "Preparing your personalized recommendation..."),
    ],
    "motor": [
        ("intent",   "Understanding your vehicle insurance needs..."),
        ("vehicle",  "Reviewing vehicle details..."),
        ("idv",      "Calculating Insured Declared Value..."),
        ("options",  "Finding the best motor cover for you..."),
        ("rec",      "Building your personalized motor quote..."),
    ],
    "travel": [
        ("intent",      "Understanding your travel needs..."),
        ("destination", "Analyzing destination requirements..."),
        ("options",     "Finding the right travel protection plan..."),
        ("rec",         "Preparing your travel cover recommendation..."),
    ],
    "home-property": [
        ("intent",    "Understanding your property insurance needs..."),
        ("property",  "Reviewing your property details..."),
        ("options",   "Finding the best property cover for you..."),
        ("rec",       "Preparing your property protection plan..."),
    ],
    "executive": [
        ("intent",  "Understanding what you're looking for..."),
        ("match",   "Matching you with the right specialist..."),
        ("connect", "Getting ready to connect you..."),
    ],
}

DEFAULT_THINKING = [
    ("intent",    "Understanding your request..."),
    ("category",  "Identifying the right insurance category..."),
    ("agent",     "Selecting the right specialist advisor..."),
    ("memory",    "Reviewing your conversation history..."),
    ("options",   "Finding relevant coverage options..."),
    ("rec",       "Preparing your recommendation..."),
]

# How long each thinking step stays visible (seconds)
_STEP_DURATION = 0.30


# Word-boundary anchored, for the same reason the agent boundary check is (see
# BaseAgent._forbidden_patterns): matched as substrings, "car" fired from
# "care" and "healthcare", and "flat" from "inflation" — so a health question
# was answered under the motor or property thinking-step animation.
_QUICK_DOMAIN_RE: List[Tuple[str, Any]] = [
    (domain, re.compile(r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b", re.IGNORECASE))
    for domain, keys in [
        ("motor",         ["car", "bike", "vehicle", "motor", "idv", "auto", "creta", "enfield"]),
        ("travel",        ["travel", "trip", "flight", "abroad", "international", "visa", "passport"]),
        ("home-property", ["home", "house", "property", "apartment", "building", "flat", "landlord"]),
        ("executive",     ["corporate", "business", "enterprise", "d&o", "directors", "liability"]),
    ]
]


def _quick_domain(message: str, product_type: Optional[str]) -> str:
    """Lightweight domain detector used to pick the right thinking-step sequence."""
    if product_type and product_type in THINKING_STEPS:
        return product_type
    for domain, pattern in _QUICK_DOMAIN_RE:
        if pattern.search(message):
            return domain
    return "health"


async def stream_chat(
    message: str,
    history: List[Dict[str, Any]],
    user_name: str,
    product_type: Optional[str],
    session_id: str,
    force_transfer_to: Optional[str] = None,
    declined_domains: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    voice: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    Main SSE generator — yields thinking steps while the orchestrator processes,
    then streams the reply token-by-token.

    user_id: the backend's stable customer id, preferred over user_name for
    memory isolation on this path too — the streaming route is not exempt.
    """
    domain = _quick_domain(message, product_type)
    steps = THINKING_STEPS.get(domain, DEFAULT_THINKING)

    started = time.perf_counter()
    first_token_at: Optional[float] = None

    # ── Phase 1: Start orchestrator in background immediately ────────────────
    # The sink goes into the context *before* the task is created, because
    # `create_task` copies the context as it stands at that moment. Closed in a
    # `finally` so the drain below always terminates — including when dispatch
    # raises, which is the case that would otherwise hang the request.
    sink = TokenSink()
    set_sink(sink)

    # How the customer spoke this turn, if they spoke it. Installed alongside
    # the token sink and travelling the same way — see `voice_context` for why
    # it can only reach phrasing. A typed turn passes None and adapts nothing.
    voice_context = build_voice_context(voice)
    set_voice_context(voice_context)

    async def _dispatch_and_close() -> Dict[str, Any]:
        try:
            return await _orchestrator.dispatch(
                message=message,
                history=history,
                user_name=user_name,
                session_id=session_id,
                force_transfer_to=force_transfer_to,
                initial_domain=product_type,
                declined_domains=declined_domains,
                user_id=user_id,
            )
        finally:
            sink.close()

    orch_task: asyncio.Task = asyncio.create_task(_dispatch_and_close())

    drain = sink.drain()
    next_token: asyncio.Future = asyncio.ensure_future(drain.__anext__())

    # Everything below is wrapped so an abandoned request cleans up after
    # itself. A customer cutting the advisor off — which barge-in makes an
    # ordinary event rather than a rare one — closes this generator from the
    # outside, leaving `next_token` pending. When it later resolves with
    # `StopAsyncIteration` and nobody is waiting, asyncio logs an unretrieved
    # task exception: harmless, but once per interruption it would bury the
    # real errors in the log.
    try:

        # ── Phase 2: Emit thinking steps while orchestrator runs ─────────────────
        # Cut short by the first token as well as by the orchestrator finishing.
        # Continuing to animate "Reviewing your family profile..." over words the
        # advisor is already saying would be a lie about what is happening.
        for step_id, step_label in steps:
            if orch_task.done() or next_token.done():
                break
            yield f"data: {json.dumps({'type': 'thinking', 'step': step_id, 'label': step_label})}\n\n"
            try:
                done, _pending = await asyncio.wait(
                    {orch_task, next_token},
                    timeout=_STEP_DURATION,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if done:
                    break
            except (asyncio.CancelledError, Exception):
                break

        # ── Phase 2b: Real tokens, as the model writes them ──────────────────────
        streamed_any = False
        while True:
            try:
                piece = await next_token
            except StopAsyncIteration:
                break
            except Exception as exc:  # noqa: BLE001 — a broken drain must not lose the turn
                logger.error(f"[StreamService] token drain failed: {exc}")
                break

            if not streamed_any:
                streamed_any = True
                first_token_at = time.perf_counter()
                # Who is speaking, ahead of the full metadata. The browser needs an
                # advisor name to put against the first word, and the rest of the
                # metadata — transfers, session — is not known until dispatch
                # returns. Emitted as `agent_info` so no new event type is needed;
                # the authoritative one follows below and supersedes it.
                yield "data: " + json.dumps({
                    "type": "agent_info",
                    "agent_name": sink.agent_name or "Sarah AI",
                    "agent_domain": sink.agent_domain or domain,
                    "transferred": False,
                    "suggest_transfer": False,
                    "is_interrupt": False,
                    "session_id": session_id,
                    "streaming": True,
                }) + "\n\n"

            yield f"data: {json.dumps({'type': 'token', 'text': piece})}\n\n"
            next_token = asyncio.ensure_future(drain.__anext__())

        # ── Phase 3: Collect orchestrator result ──────────────────────────────────
        try:
            result: Dict[str, Any] = await orch_task
        except Exception as exc:
            logger.error(f"[StreamService] Orchestrator error: {exc}")
            fallback = (
                "I encountered an unexpected issue while preparing your recommendation. "
                "Could you please rephrase your question or provide a bit more detail? "
                "I'm here to help."
            )
            yield f"data: {json.dumps({'type': 'error', 'message': fallback})}\n\n"
            return

        reply: str          = result.get("reply", "")
        agent_name: str     = result.get("agent_name", "Sarah AI")
        agent_domain: str   = result.get("agent_domain", domain)
        transferred: bool   = result.get("transferred", False)
        suggest_transfer: bool = result.get("suggest_transfer", False)
        out_session_id: str = result.get("session_id", session_id)

        # ── Phase 4: Emit agent metadata (signals frontend: thinking → streaming) ─
        agent_info_payload = {
            "type":               "agent_info",
            "agent_name":         agent_name,
            "agent_domain":       agent_domain,
            "transferred":        transferred,
            "suggest_transfer":   suggest_transfer,
            "is_interrupt":       result.get("is_interrupt", False),
            "transfer_from":      result.get("transfer_from"),
            "transfer_from_name": result.get("transfer_from_name"),
            "transfer_to":        result.get("transfer_to"),
            "transfer_to_name":   result.get("transfer_to_name"),
            "transfer_reason":    result.get("transfer_reason"),
            "previous_agent":     result.get("previous_agent"),
            "session_id":         out_session_id,
        }
        if voice_context is not None:
            # Where this turn sits in the existing 9-state conversation, as the
            # middleware already computed it. Sent so the voice layer can decide how
            # to *deliver* a reply without keeping a second state machine that would
            # then need keeping in sync with this one.
            agent_info_payload["conversation_state"] = voice_context.conversation_state
            agent_info_payload["intent"] = voice_context.intent
        yield f"data: {json.dumps(agent_info_payload)}\n\n"

        # ── Phase 5: Stream reply in word-batches for smooth rendering ────────────
        # An empty reply used to stream no tokens at all, which left an empty bubble
        # on screen — indistinguishable, to the customer, from the advisor ignoring
        # them. It happened for real on the turn after a recommendation. Whatever
        # emptied it upstream, nothing silent should reach the screen.
        if not reply.strip():
            logger.warning("[StreamService] Orchestrator returned an empty reply — substituting a prompt to repeat")
            reply = "Could you say that once more? I want to be sure I answer the right thing."

        if streamed_any:
            # ── Reconcile what was released against the turn's real answer ────────
            remainder = sink.reconcile(reply)

            if remainder is None:
                # Divergence. The released text is no longer what this turn says —
                # almost always because the LLM died part-way and the agent answered
                # in its own voice instead. Correcting the screen is the only honest
                # option: leaving half a retracted sentence up, or appending the
                # fallback after it, would both read as the advisor contradicting
                # itself.
                logger.warning(
                    "[StreamService] streamed text diverged from the final reply "
                    f"({len(sink.released)} chars released) — replacing"
                )
                yield f"data: {json.dumps({'type': 'replace', 'text': reply})}\n\n"
            elif remainder:
                # The tail. In practice this is the `[RECOMMENDATION:{...}]` card the
                # embedder appends — a payload, not prose, so it goes in one piece
                # rather than being paced out word by word.
                yield f"data: {json.dumps({'type': 'token', 'text': remainder})}\n\n"

        elif reply:
            # ── The buffered path, unchanged ─────────────────────────────────────
            # Reached whenever streaming was refused or unavailable: a turn whose
            # guardrails could still rewrite the reply, a provider that cannot
            # stream, a tool call, or a stream that failed before releasing
            # anything. The word-batch replay is not real streaming and never was,
            # but it is the right thing to show when the text only exists now.
            words = reply.split(" ")
            batch_size = 2  # 2 words per frame ≈ natural reading pace
            for i in range(0, len(words), batch_size):
                chunk = " ".join(words[i : i + batch_size])
                if i + batch_size < len(words):
                    chunk += " "
                yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
                await asyncio.sleep(0.025)

        # ── Phase 6: Done signal ──────────────────────────────────────────────────
        # The latency numbers ride along so the path can be measured from the
        # outside, without a second endpoint or a metrics scrape: what a customer
        # experiences is time-to-first-word, and before this change that number did
        # not exist separately from the total.
        total_ms = int((time.perf_counter() - started) * 1000)
        latency = {
            "streamed": streamed_any,
            "total_ms": total_ms,
            "first_token_ms": (
                int((first_token_at - started) * 1000) if first_token_at is not None else None
            ),
            "dropped_tokens": sink.dropped,
        }
        if streamed_any:
            logger.info(
                f"[StreamService] streamed turn — first token {latency['first_token_ms']}ms, "
                f"total {total_ms}ms, agent={agent_name}"
            )
        yield "data: " + json.dumps(
            {"type": "done", "session_id": out_session_id, "latency": latency}
        ) + "\n\n"
    finally:
        if not next_token.done():
            next_token.cancel()
        elif not next_token.cancelled():
            # Read the outcome, so a future that completed while nobody was
            # waiting is not reported as unhandled either.
            next_token.exception()

        # A customer who leaves mid-turn — closing the tab, or barge-in
        # abandoning this reply — used to leave `orch_task` running to
        # completion regardless: the generator exits, but the LLM call inside
        # `dispatch()` keeps going in the background and the paid call is
        # spent on a customer who is no longer there to receive it. Cancelling
        # here is a no-op when the turn already finished normally (Phase 3
        # already awaited it, so `.cancel()` on a done task does nothing) and
        # stops real work only when it was genuinely abandoned.
        if not orch_task.done():
            orch_task.cancel()
