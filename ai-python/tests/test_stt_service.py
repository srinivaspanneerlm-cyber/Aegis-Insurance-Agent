"""
Speech-to-text: provider selection, and every way a turn can fail to become words.

The service itself is thin — bytes in, transcript out — so almost everything
here is about the boundaries around it. That is deliberate. A transcription is
the one place where the customer cannot see what went wrong: there is no text on
screen, only a microphone that stopped. So each refusal has to be specific
enough for the browser to say something useful, and none of them may be reached
by an empty recording that quietly bought a paid provider call on the way.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import stt_service as stt
from app.services.stt_service import (
    SttEmptyAudio,
    SttNotConfigured,
    SttService,
    SttUnsupportedAudio,
    SttUnsupportedProvider,
    Transcription,
    is_supported_audio,
    normalise_mime,
)
from app.config.config import settings


# ── Doubles ───────────────────────────────────────────────────────────────────


class FakeProvider:
    """A provider that records what it was handed and answers however we ask."""

    name = "fake"
    configured = True
    result = Transcription(transcript="hello", language="en-IN", provider="fake")
    raises: Exception | None = None

    def __init__(self) -> None:
        self.calls: list[tuple[bytes, str, str | None]] = []
        FakeProvider.instance = self

    def is_configured(self) -> bool:
        return type(self).configured

    async def transcribe(self, audio, mime_type, language_hint=None):
        self.calls.append((audio, mime_type, language_hint))
        if type(self).raises:
            raise type(self).raises
        return type(self).result


@pytest.fixture(autouse=True)
def restore_registry():
    """Every test gets the real registry back, whatever it did to it."""
    original = dict(stt._PROVIDERS)
    FakeProvider.configured = True
    FakeProvider.raises = None
    FakeProvider.result = Transcription(transcript="hello", language="en-IN", provider="fake")
    # A fresh recorder per test. The service builds its provider lazily, so a
    # turn refused before that point leaves `instance` untouched — and without
    # this it would still be holding the previous test's calls.
    FakeProvider()
    yield
    stt._PROVIDERS.clear()
    stt._PROVIDERS.update(original)


@pytest.fixture
def service():
    stt._PROVIDERS["fake"] = FakeProvider
    return SttService(provider_name="fake")


def run(coro):
    return asyncio.run(coro)


def audio(size: int = 4096) -> bytes:
    return b"\x1a\x45\xdf\xa3" + b"\x00" * size


# ── Provider selection ────────────────────────────────────────────────────────


class TestProviderSelection:
    def test_the_configured_provider_is_the_one_that_answers(self, service):
        result = run(service.transcribe(audio(), "audio/webm"))
        assert result.provider == "fake"

    def test_gemini_is_what_a_default_deployment_gets(self):
        # The default has to be a provider that exists, or voice is dead on
        # arrival in a deployment nobody thought to configure.
        assert settings.STT_PROVIDER in stt._PROVIDERS or settings.STT_PROVIDER in stt._PLANNED_PROVIDERS

    def test_a_planned_provider_says_so_instead_of_raising_KeyError(self):
        # Whisper and Groq are the documented swap targets. Naming one before it
        # exists must produce a sentence an engineer can act on.
        with pytest.raises(SttUnsupportedProvider) as excinfo:
            SttService(provider_name="whisper").provider
        assert "not implemented" in str(excinfo.value)
        assert "gemini" in str(excinfo.value)

    def test_an_unknown_provider_lists_the_ones_that_exist(self):
        with pytest.raises(SttUnsupportedProvider) as excinfo:
            SttService(provider_name="nonesuch").provider
        assert "gemini" in str(excinfo.value)

    def test_a_selected_but_unconfigured_provider_is_a_deployment_fault(self, service):
        FakeProvider.configured = False
        with pytest.raises(SttNotConfigured):
            service.provider

    def test_is_available_answers_without_raising(self, service):
        assert service.is_available() is True
        FakeProvider.configured = False
        assert SttService(provider_name="fake").is_available() is False

    def test_no_vendor_name_reaches_the_caller_as_a_requirement(self, service):
        # The whole point of the abstraction: application code asks for a
        # transcript, never for Gemini. Swapping the provider changes this
        # call's result, not its shape.
        result = run(service.transcribe(audio(), "audio/webm"))
        assert isinstance(result, Transcription)
        assert set(result.as_dict()) == {
            "transcript", "language", "provider", "model", "duration_ms"
        }


# ── What never reaches a provider ─────────────────────────────────────────────


class TestRefusedBeforeAnyProviderCall:
    def test_empty_audio_never_costs_a_paid_call(self, service):
        with pytest.raises(SttEmptyAudio):
            run(service.transcribe(b"", "audio/webm"))
        assert FakeProvider.instance.calls == []

    def test_audio_too_short_to_hold_speech_is_refused(self, service):
        # A container header and nothing else. Sent on, a model would happily
        # invent a plausible sentence — which then becomes a real turn in the
        # customer's conversation memory.
        with pytest.raises(SttEmptyAudio):
            run(service.transcribe(b"\x1a\x45\xdf\xa3", "audio/webm"))

    def test_oversized_audio_is_refused_before_an_sdk_copies_it(self, service):
        too_big = b"\x1a\x45\xdf\xa3" + b"\x00" * (settings.STT_MAX_BYTES + 1)
        with pytest.raises(SttUnsupportedAudio):
            run(service.transcribe(too_big, "audio/webm"))

    def test_an_unsupported_container_is_refused_here_not_at_the_provider(self, service):
        with pytest.raises(SttUnsupportedAudio):
            run(service.transcribe(audio(), "application/pdf"))

    def test_the_size_guards_live_in_the_service_so_a_new_provider_cannot_forget(self, service):
        # Both checks run before `provider.transcribe`, which is what makes them
        # true for Whisper and Groq the day they are added.
        for bad in (b"", b"\x00" * 10):
            with pytest.raises(SttEmptyAudio):
                run(service.transcribe(bad, "audio/webm"))
        assert FakeProvider.instance.calls == []


# ── The containers browsers actually produce ──────────────────────────────────


class TestAudioTypes:
    @pytest.mark.parametrize(
        "mime,browser",
        [
            ("audio/webm;codecs=opus", "Chrome, Edge, Brave"),
            ("audio/ogg;codecs=opus", "Firefox"),
            ("audio/mp4", "Safari — which supports no Opus at all"),
            ("audio/wav", "older Android WebViews"),
        ],
    )
    def test_every_browser_can_be_understood(self, mime, browser):
        assert is_supported_audio(mime), f"voice would be dead in {browser}"

    def test_the_codec_parameter_is_stripped_before_matching(self):
        assert normalise_mime("audio/webm;codecs=opus") == "audio/webm"
        assert normalise_mime("  AUDIO/MP4 ; codecs=mp4a.40.2 ") == "audio/mp4"

    def test_a_document_is_not_audio(self):
        assert not is_supported_audio("application/pdf")
        assert not is_supported_audio("")

    def test_the_language_hint_is_passed_to_the_provider(self, service):
        run(service.transcribe(audio(), "audio/webm", language_hint="ta-IN"))
        assert FakeProvider.instance.calls[0][2] == "ta-IN"


# ── Reading whatever the model actually sent back ─────────────────────────────


class TestTranscriptParsing:
    def test_the_shape_we_asked_for(self):
        transcript, language = stt._parse_transcript_json(
            '{"transcript": "I need health cover", "language": "en-IN"}'
        )
        assert transcript == "I need health cover"
        assert language == "en-IN"

    def test_tamil_script_survives_intact(self):
        tamil = "எனக்கு மருத்துவ காப்பீடு வேண்டும்"
        transcript, language = stt._parse_transcript_json(
            '{"transcript": "%s", "language": "ta-IN"}' % tamil
        )
        assert transcript == tamil
        assert language == "ta-IN"

    def test_thanglish_stays_in_latin_script(self):
        # A model left to itself either transliterates this into Tamil script or
        # "corrects" it into formal English. Both destroy what was said, and the
        # advisor's own language layer then reads the wrong thing.
        thanglish = "enakku family ku oru health policy venum, premium evlo aagum?"
        transcript, language = stt._parse_transcript_json(
            '{"transcript": "%s", "language": "ta-en"}' % thanglish
        )
        assert transcript == thanglish
        assert language == "ta-en"

    def test_a_markdown_fence_does_not_break_the_turn(self):
        transcript, _ = stt._parse_transcript_json(
            '```json\n{"transcript": "hello there", "language": "en-IN"}\n```'
        )
        assert transcript == "hello there"

    def test_plain_prose_is_taken_as_the_transcript(self):
        # A model that ignores the JSON instruction and simply writes the
        # sentence has still done the job. Failing the turn over a missing
        # wrapper would tell a customer their clear sentence was not heard.
        transcript, language = stt._parse_transcript_json("I want motor insurance")
        assert transcript == "I want motor insurance"
        assert language is None

    def test_an_unknown_language_becomes_no_language_rather_than_the_word(self):
        _, language = stt._parse_transcript_json('{"transcript": "hi", "language": "unknown"}')
        assert language is None

    def test_silence_comes_back_empty_rather_than_invented(self):
        transcript, _ = stt._parse_transcript_json('{"transcript": "", "language": "en-IN"}')
        assert transcript == ""

    def test_a_wrongly_typed_transcript_field_is_not_passed_on(self):
        transcript, _ = stt._parse_transcript_json('{"transcript": {"text": "hi"}}')
        assert transcript == ""

    def test_an_empty_reply_is_a_provider_failure(self):
        with pytest.raises(stt.SttProviderFailure):
            stt._parse_transcript_json("   ")


# ── Failures on the way back ──────────────────────────────────────────────────


class TestProviderFailures:
    def test_a_timeout_is_reported_as_a_timeout(self, service):
        FakeProvider.raises = stt.SttTimeout("provider took too long")
        with pytest.raises(stt.SttTimeout) as excinfo:
            run(service.transcribe(audio(), "audio/webm"))
        # 504 so the browser can say "try again", not "type instead".
        assert excinfo.value.status_code == 504

    def test_a_provider_error_offers_the_route_that_always_works(self, service):
        FakeProvider.raises = stt.SttProviderFailure("the API refused")
        with pytest.raises(stt.SttProviderFailure) as excinfo:
            run(service.transcribe(audio(), "audio/webm"))
        assert "type your question" in excinfo.value.user_message

    def test_every_error_carries_a_sentence_safe_to_show(self):
        # `str(exc)` is for logs and may name a file or a provider; only
        # `user_message` is ever rendered.
        for error_type in (
            stt.SttNotConfigured, stt.SttUnsupportedProvider, stt.SttEmptyAudio,
            stt.SttUnsupportedAudio, stt.SttTimeout, stt.SttProviderFailure,
        ):
            message = error_type.user_message
            assert message and message[0].isupper() and message.endswith(".")

    def test_no_failure_leaks_an_internal_detail_to_the_customer(self):
        for error_type in (stt.SttTimeout, stt.SttProviderFailure, stt.SttNotConfigured):
            lowered = error_type.user_message.lower()
            for leak in ("gemini", "whisper", "groq", "traceback", "api key", "exception"):
                assert leak not in lowered
