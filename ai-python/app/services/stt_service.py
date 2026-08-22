"""
Aegis AI — Speech-to-text, as a provider-neutral service.

Voice input used to be the browser's job: `webkitSpeechRecognition` listened,
Chromium streamed the audio to Google, and a transcript came back. That worked
for exactly one browser family and it excluded the people this product is for.
Firefox and Safari ship no recogniser at all. Brave ships Chromium's with
Google's key removed on purpose, so every attempt fails with `network` — see
`frontend/src/lib/voiceSupport.ts`, which exists only because of that. And none
of them do Tamil or Thanglish well, because Chrome's recogniser is given one
`lang` up front and code-switching mid-sentence is not something it expects.

So the audio comes here instead, and the transcription is a service with a
provider behind it — the same shape `LLMService` already has:

    settings.STT_PROVIDER    which one transcribes
    transcribe(audio, ...)   what every provider must be able to do

Application code — the route, the Node backend, the browser — never names a
vendor. Swapping Gemini for Whisper or Groq is a `.env` edit and one new class
in `_PROVIDERS`, not a change anywhere a transcript is used. Only Gemini is
implemented today because only Gemini is configured here and it is the one
proven on Tamil and Thanglish; the other two are registered as known-but-absent
so choosing one fails with a sentence that says what to do rather than a
`KeyError`.

Deliberately *not* here: any conversation state. This service is handed bytes
and returns text. The transcript goes back to the browser and re-enters the
system through the same send path a typed message uses, so a spoken turn and a
typed turn are indistinguishable to `CentralOrchestrator`, `SessionManager` and
`MemoryOrchestrator`. There is no second orchestrator and no second session.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol, Type

import google.generativeai as genai

from app.config.config import settings
from app.utils.logger import logger

# ── Errors ────────────────────────────────────────────────────────────────────
# Each one maps to a distinct thing the customer can be told. A single generic
# exception would collapse "your recording was silent" and "the transcription
# service is down" into the same unhelpful message, and those need opposite
# responses: speak again, versus type instead.


class SttError(Exception):
    """Base class. `user_message` is safe to show; `str(self)` is for logs only."""

    status_code = 502
    user_message = "Voice input is unavailable right now. Please type your question instead."


class SttNotConfigured(SttError):
    """No usable provider — a deployment problem, not a customer one."""

    status_code = 503
    user_message = "Voice input is not available right now. Please type your question instead."


class SttUnsupportedProvider(SttError):
    """`STT_PROVIDER` names something this build cannot do."""

    status_code = 503
    user_message = "Voice input is not available right now. Please type your question instead."


class SttEmptyAudio(SttError):
    """Nothing was recorded, or so little that no provider could use it."""

    status_code = 422
    user_message = "We didn't catch that. Tap the mic and speak again."


class SttUnsupportedAudio(SttError):
    """A format no provider here accepts."""

    status_code = 415
    user_message = "This browser's recording format isn't supported. Please type your question instead."


class SttTimeout(SttError):
    """The provider did not answer inside `STT_TIMEOUT_SECONDS`."""

    status_code = 504
    user_message = "Transcribing took too long. Please try again, or type your question."


class SttProviderFailure(SttError):
    """The provider was reached and refused, errored, or returned nothing usable."""

    status_code = 502
    user_message = "We couldn't turn that into words. Please try again, or type your question."


# ── Result ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Transcription:
    """
    What every provider returns, whatever it is underneath.

    `language` is a BCP-47-ish hint, not a promise: `en-IN`, `ta-IN`, or
    `ta-en` for the Thanglish the customers here actually speak — Tamil grammar
    with English insurance nouns, in Latin script. It is carried rather than
    acted on. The transcript itself goes to the advisor verbatim, and the
    existing language layer reads it there exactly as it reads a typed message;
    this field is metadata for the UI and for logs, not a second translation
    system.
    """

    transcript: str
    language: Optional[str]
    provider: str
    model: Optional[str] = None
    duration_ms: int = 0

    def as_dict(self) -> Dict[str, Any]:
        return {
            "transcript": self.transcript,
            "language": self.language,
            "provider": self.provider,
            "model": self.model,
            "duration_ms": self.duration_ms,
        }


# ── The contract ──────────────────────────────────────────────────────────────


class SttProvider(Protocol):
    """
    What a transcription backend has to be able to do. Three things, so that
    adding Whisper or Groq later is a small, obvious piece of work.
    """

    name: str

    def is_configured(self) -> bool:
        """Whether this provider has everything it needs to be called at all."""
        ...

    async def transcribe(
        self, audio: bytes, mime_type: str, language_hint: Optional[str] = None
    ) -> Transcription:
        """Bytes in, words out. Raises an `SttError` subclass on any failure."""
        ...


# ── Audio the service will accept ─────────────────────────────────────────────
# Browsers do not agree on a recording container, and that disagreement is the
# whole reason this works everywhere: Chrome, Edge and Brave produce WebM/Opus,
# Firefox produces Ogg/Opus, and Safari — the only one with no Opus at all —
# produces MP4/AAC. All four are listed, so the browser records what it can and
# the server takes it as-is. Nothing is transcoded; a transcode step would mean
# ffmpeg in the image and a CPU cost on every turn.

SUPPORTED_AUDIO_MIMES: Dict[str, str] = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/flac": "flac",
}


def normalise_mime(mime_type: str) -> str:
    """
    `audio/webm;codecs=opus` → `audio/webm`.

    MediaRecorder reports the codec alongside the container and providers key
    off the container. Lowercased and stripped so a browser that pads the
    parameter list does not fail a lookup on whitespace.
    """
    return (mime_type or "").split(";")[0].strip().lower()


def is_supported_audio(mime_type: str) -> bool:
    return normalise_mime(mime_type) in SUPPORTED_AUDIO_MIMES


# ── Gemini ────────────────────────────────────────────────────────────────────

# Asks for one JSON object and nothing else. Two things are worth naming:
#
#   Thanglish is called out explicitly. Left alone, a model asked to transcribe
#   Tamil-accented English either translates it into Tamil script or "corrects"
#   it into formal English, and both destroy what the customer said. The
#   instruction is to write it the way it was spoken.
#
#   Silence must come back empty, not guessed at. A model handed a second of
#   room noise will happily invent a plausible sentence, and an invented
#   sentence here becomes a real turn: a paid LLM call, a line in the customer's
#   conversation memory, and an advisor answering a question nobody asked.
_GEMINI_PROMPT = """You are a speech transcription engine for an Indian insurance advisory service.

Transcribe the audio exactly as spoken. Do not translate, summarise, correct grammar, or add anything.

The speaker may use English, Tamil, or Thanglish (Tamil and English mixed in one sentence, written in Latin script).
- If they speak Tamil in Tamil, write Tamil script.
- If they speak Tamil words in Latin script style (Thanglish), keep Latin script exactly as spoken.
- Keep English insurance words (policy, premium, claim, cover) in English.

Reply with ONLY a JSON object, no markdown fence, no commentary:
{"transcript": "<exactly what was said, or empty string if there is no speech>", "language": "<en-IN|ta-IN|ta-en|unknown>"}

If the audio contains no intelligible speech, return an empty transcript. Never invent words."""


class GeminiSttProvider:
    """
    Transcription via Gemini's multimodal input.

    Reuses the key and the model name already configured for the chat path
    (`GEMINI_API_KEY`, `STT_MODEL` defaulting to `GEMINI_MODEL`) rather than
    introducing a second credential. `genai.configure` is global and idempotent,
    so calling it here is safe whether or not `LLMService` got there first.
    """

    name = "gemini"

    def __init__(self) -> None:
        self._configured = False
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._configured = True
        else:
            logger.warning("GEMINI_API_KEY missing — the Gemini STT provider cannot run.")

    def is_configured(self) -> bool:
        return self._configured

    async def transcribe(
        self, audio: bytes, mime_type: str, language_hint: Optional[str] = None
    ) -> Transcription:
        if not self._configured:
            raise SttNotConfigured("Gemini STT provider has no API key.")

        container = normalise_mime(mime_type)
        if container not in SUPPORTED_AUDIO_MIMES:
            raise SttUnsupportedAudio(f"unsupported audio container: {container}")

        started = time.perf_counter()
        model = genai.GenerativeModel(model_name=settings.stt_model)

        prompt = _GEMINI_PROMPT
        if language_hint:
            # A hint, never a constraint. Pinning the model to one language is
            # what made the browser recogniser unusable for a customer who
            # switches languages mid-sentence, and repeating that mistake here
            # would waste the move to the server.
            prompt += f"\n\nThe speaker's interface language is {language_hint}, but they may speak any of the above."

        try:
            response = await asyncio.wait_for(
                model.generate_content_async(
                    [prompt, {"mime_type": container, "data": audio}],
                    generation_config={"temperature": 0.0, "response_mime_type": "application/json"},
                ),
                timeout=settings.STT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise SttTimeout(
                f"Gemini STT exceeded {settings.STT_TIMEOUT_SECONDS}s"
            ) from exc
        except Exception as exc:  # provider SDK raises a wide family of its own
            raise SttProviderFailure(f"Gemini STT call failed: {type(exc).__name__}: {exc}") from exc

        raw = _extract_text(response)
        transcript, language = _parse_transcript_json(raw)

        return Transcription(
            transcript=transcript,
            language=language or language_hint,
            provider=self.name,
            model=settings.stt_model,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )


def _extract_text(response: Any) -> str:
    """
    The `.text` off a Gemini response, without letting its absence become a 500.

    `.text` raises rather than returning None when the candidate was blocked or
    empty, which is an ordinary outcome for a recording of a quiet room.
    """
    try:
        text = getattr(response, "text", None)
    except Exception:  # noqa: BLE001 — SDK raises on blocked/empty candidates
        text = None
    if text:
        return str(text)

    # Fall back to walking the candidate parts, which survive some of the cases
    # `.text` refuses to summarise.
    try:
        parts = response.candidates[0].content.parts
        return "".join(getattr(p, "text", "") or "" for p in parts)
    except Exception:  # noqa: BLE001
        return ""


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _parse_transcript_json(raw: str) -> tuple[str, Optional[str]]:
    """
    `(transcript, language)` from whatever the model actually sent.

    A malformed reply is not allowed to fail the turn. `response_mime_type` asks
    for JSON and the prompt asks again, but a model that ignores both and simply
    writes the sentence out has still done the job — so plain prose is treated
    as the transcript with an unknown language, and only genuinely empty output
    raises. The alternative is telling a customer their perfectly clear sentence
    could not be heard because a wrapper was missing.
    """
    text = _FENCE.sub("", (raw or "").strip()).strip()
    if not text:
        raise SttProviderFailure("provider returned no content")

    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("STT provider returned non-JSON output; treating it as the transcript.")
        return text, None

    if not isinstance(parsed, dict):
        return text, None

    transcript = parsed.get("transcript")
    language = parsed.get("language")
    if not isinstance(transcript, str):
        return "", None
    if not isinstance(language, str) or language.lower() in ("", "unknown", "null"):
        language = None
    return transcript.strip(), language


# ── Registry ──────────────────────────────────────────────────────────────────
# Adding Whisper or Groq is: write the class, add the line. Nothing else in the
# codebase learns the name.

_PROVIDERS: Dict[str, Type[Any]] = {
    "gemini": GeminiSttProvider,
}

# Named so `STT_PROVIDER=whisper` fails with a sentence instead of a KeyError,
# and so the swap points are visible in the source rather than only in a doc.
_PLANNED_PROVIDERS = ("whisper", "groq", "openai")


class SttService:
    """
    The one entry point. Resolves `STT_PROVIDER` once and transcribes through it.

    No fallback chain, unlike `LLMService`. A failed transcription has a good
    answer already — the customer types instead, which always works — and
    silently sending the same audio to a second vendor is a privacy decision
    that should be made in `.env`, not by a retry.
    """

    def __init__(self, provider_name: Optional[str] = None) -> None:
        self.provider_name = (provider_name or settings.STT_PROVIDER).strip().lower()
        self._provider: Optional[SttProvider] = None

    @property
    def provider(self) -> SttProvider:
        if self._provider is None:
            self._provider = self._build()
        return self._provider

    def _build(self) -> SttProvider:
        name = self.provider_name
        if name in _PLANNED_PROVIDERS:
            raise SttUnsupportedProvider(
                f"STT_PROVIDER='{name}' is a planned provider that is not implemented in this build. "
                f"Set STT_PROVIDER to one of: {', '.join(sorted(_PROVIDERS))}."
            )
        factory = _PROVIDERS.get(name)
        if factory is None:
            raise SttUnsupportedProvider(
                f"STT_PROVIDER='{name}' is not a known provider. "
                f"Set STT_PROVIDER to one of: {', '.join(sorted(_PROVIDERS))}."
            )
        provider = factory()
        if not provider.is_configured():
            raise SttNotConfigured(f"STT provider '{name}' is selected but not configured.")
        return provider

    def is_available(self) -> bool:
        """Whether a turn could be transcribed right now. Never raises."""
        try:
            return self.provider.is_configured()
        except SttError:
            return False

    async def transcribe(
        self,
        audio: bytes,
        mime_type: str,
        language_hint: Optional[str] = None,
    ) -> Transcription:
        """
        Transcribe one recording.

        Size and emptiness are checked here rather than in each provider, so a
        new provider cannot forget them — an empty upload must never become a
        paid call, and an oversized one must be refused before it is held in
        memory a second time by an SDK.
        """
        if not audio or len(audio) < settings.STT_MIN_BYTES:
            raise SttEmptyAudio(f"audio too short: {len(audio or b'')} bytes")
        if len(audio) > settings.STT_MAX_BYTES:
            raise SttUnsupportedAudio(
                f"audio too large: {len(audio)} bytes (limit {settings.STT_MAX_BYTES})"
            )
        if not is_supported_audio(mime_type):
            raise SttUnsupportedAudio(f"unsupported audio type: {mime_type}")

        result = await self.provider.transcribe(audio, mime_type, language_hint)

        # Deliberately logs the shape of the turn and never its content. A
        # transcript is whatever the customer chose to say out loud — a medical
        # condition, an income, a family situation — and it has no business in a
        # log line that outlives the request.
        logger.info(
            f"STT ok — provider={result.provider} bytes={len(audio)} "
            f"chars={len(result.transcript)} lang={result.language} in {result.duration_ms}ms"
        )
        return result


# Module-level singleton, matching how the chat service is reached elsewhere.
# Built lazily so an unconfigured deployment fails on the first voice request
# with a clear message rather than at import time, taking the whole engine — and
# the typed chat path, which needs none of this — down with it.
_service: Optional[SttService] = None


def get_stt_service() -> SttService:
    global _service
    if _service is None:
        _service = SttService()
    return _service
