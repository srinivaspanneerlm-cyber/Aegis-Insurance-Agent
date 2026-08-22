"""
Aegis AI — what the voice layer knows about how a turn was spoken.

A spoken turn carries information a typed one does not. The customer said "I
don't understand any of this" rather than typing it; they said it after two
failed attempts; they said it in six words instead of forty. None of that
changes what they are entitled to, what a plan costs, or which plan the engine
picks — and this module must never be able to. It changes how the advisor
*speaks back*, which is the one thing a voice layer is for.

Three rules hold this in place, and they are the reason the file is this small:

  **It carries observations, not conclusions.** `style` is a description of the
  wording — repeated punctuation, "I don't understand", "urgent" — not a claim
  about the person. Aegis is not qualified to decide that a customer is upset,
  and a system that acted on such a guess would be wrong in public, about
  someone's insurance, in their own words. See `app/prompts/voice_style_prompts`
  for how narrowly the resulting instruction is written.

  **It is advisory, and only about phrasing.** The context reaches exactly one
  place — a block of prompt text appended beside `DOCUMENT_REQUEST_PROMPT`, which
  already carries the same guarantee: it changes how an ask is worded, never what
  the agent decides. Recommendation scoring, premium arithmetic, plan
  withholding, the executive gate and the consultation pipeline never see it.

  **It duplicates no memory.** Nothing here is stored. It lives for one request,
  in a `contextvars` slot, and is gone. The conversation, the profile and the
  session all remain exactly where they were — a spoken turn and a typed turn
  are the same conversation to `SessionManager` and `MemoryOrchestrator`, which
  is the whole point of Step 4's single send path.

The slot is also a two-way channel. The browser puts in what it observed; the
turn puts back the conversation stage the middleware computed, so the voice
layer can decide how to *deliver* a reply without a second state machine of its
own and without a round trip to fetch it.
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional


# ── Styles ────────────────────────────────────────────────────────────────────
#
# Every name below describes the *wording of a message*, not a state of mind.
# "frustrated" means the message has the shape of frustration — a repetition, a
# "still not working", a raised voice in punctuation. Whether the person is
# actually frustrated is not something this can know, and not something it
# needs to know to answer more plainly and get to the point.

STYLE_NORMAL = "normal"
STYLE_CONFUSED = "confused"
STYLE_FRUSTRATED = "frustrated"
STYLE_URGENT = "urgent"
STYLE_BRIEF = "brief"

VOICE_STYLES = frozenset(
    {STYLE_NORMAL, STYLE_CONFUSED, STYLE_FRUSTRATED, STYLE_URGENT, STYLE_BRIEF}
)


def normalise_style(raw: Optional[str]) -> str:
    """
    A style this build understands, or `normal`.

    The value arrives from the browser, so it is input: unknown, missing,
    malformed or hostile all resolve to the default, which is the behaviour the
    system had before any of this existed. Adaptation failing must never be
    able to cost a customer their answer.
    """
    if not raw or not isinstance(raw, str):
        return STYLE_NORMAL
    candidate = raw.strip().lower()
    return candidate if candidate in VOICE_STYLES else STYLE_NORMAL


# ── The context ───────────────────────────────────────────────────────────────


@dataclass
class VoiceTurnContext:
    """One spoken turn's worth of interaction context. Never persisted."""

    # ── In: what the browser observed ─────────────────────────────────────────
    style: str = STYLE_NORMAL
    """How the message was worded. See the note above: a description, not a diagnosis."""

    language: Optional[str] = None
    """
    What the transcription service heard — `en-IN`, `ta-IN`, `ta-en`.

    Metadata, and deliberately inert. Aegis answers in English unless the
    customer *asks* for another language in words, which `detect_language_request`
    picks up from the transcript exactly as it does from typed text. Speaking
    Tamil is not asking for Tamil — mirroring whichever language the last message
    happened to be in was a reported complaint, because people quote relatives
    and code-switch mid-sentence, and an advisor that changed language on each of
    those reads as unstable. This field is here to be *shown*, not obeyed.
    """

    spoken: bool = True
    """Whether this turn arrived by voice. False is a typed turn and adapts nothing."""

    # ── Out: what the turn decided ────────────────────────────────────────────
    conversation_state: Optional[str] = None
    """The middleware's stage for this turn — read, never set, by the voice layer."""

    intent: Optional[str] = None
    """The middleware's intent for this turn (explain / compare / purchase / general)."""

    def adapts(self) -> bool:
        """Whether anything about this turn is worth adapting for."""
        return self.spoken and self.style != STYLE_NORMAL

    def record_stage(self, state: Optional[str], intent: Optional[str]) -> None:
        """Note what the middleware decided, for the browser's delivery policy."""
        self.conversation_state = state
        self.intent = intent


_voice_context: ContextVar[Optional[VoiceTurnContext]] = ContextVar(
    "aegis_voice_context", default=None
)


def set_voice_context(context: Optional[VoiceTurnContext]) -> None:
    """Install the context for this request and everything spawned from it."""
    _voice_context.set(context)


def current_voice_context() -> Optional[VoiceTurnContext]:
    """This request's voice context, if it has one. Never raises."""
    try:
        return _voice_context.get()
    except LookupError:
        return None


def build_voice_context(payload: Optional[dict]) -> Optional[VoiceTurnContext]:
    """
    A context from whatever the browser sent, or None if it sent nothing.

    Defensive throughout: this is the boundary where client-supplied data enters
    the prompt path, and every field is either recognised or replaced. A typed
    turn sends no `voice` block at all and gets None, which is what makes typed
    chat provably unchanged.
    """
    if not payload or not isinstance(payload, dict):
        return None
    if not payload.get("spoken", True):
        return None

    language = payload.get("language")
    if not isinstance(language, str) or len(language) > 16:
        language = None

    return VoiceTurnContext(
        style=normalise_style(payload.get("style")),
        language=language,
        spoken=True,
    )
