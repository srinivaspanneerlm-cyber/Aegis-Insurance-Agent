"""
POST /api/ai/voice/transcribe — the engine's side of the voice hop.

Thin by design: it validates, calls the STT service, and turns an `SttError`
into the status that matches its cause. Both halves of that matter. The
validation is what stops a mislabelled body reaching a paid provider, and the
status mapping is what lets the browser tell "speak again" apart from "type
instead" — which are opposite instructions, and the customer cannot see which
one applies because there is nothing on screen either way.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import stt_service as stt
from app.services.stt_service import Transcription
from app.routes import voice_routes
from app.config.config import settings
import main


WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 4096


class FakeService:
    """Stands in for the real service so no provider is ever called."""

    def __init__(self):
        self.calls = []
        self.result = Transcription(
            transcript="I need health cover for my parents",
            language="en-IN",
            provider="gemini",
            model="gemini-3.5-flash",
            duration_ms=140,
        )
        self.raises = None

    async def transcribe(self, audio, mime_type, language_hint=None):
        self.calls.append((audio, mime_type, language_hint))
        if self.raises:
            raise self.raises
        return self.result


@pytest.fixture
def fake(monkeypatch):
    service = FakeService()
    monkeypatch.setattr(voice_routes, "get_stt_service", lambda: service)
    return service


@pytest.fixture
def client():
    return TestClient(main.app)


def post(client, body=WEBM, content_type="audio/webm", language=None, authed=True):
    headers = {"Content-Type": content_type}
    if language:
        headers["X-Audio-Language"] = language
    if authed and settings.AI_INTERNAL_API_KEY:
        # Only the Node backend holds this. Its absence is tested below.
        headers["X-Internal-Api-Key"] = settings.AI_INTERNAL_API_KEY
    return client.post("/api/ai/voice/transcribe", content=body, headers=headers)


class TestGate:
    def test_a_caller_without_the_service_key_is_refused(self, client, fake):
        if not settings.AI_INTERNAL_API_KEY:
            pytest.skip("internal-key enforcement is disabled in this environment")
        # Transcription spends paid provider quota. Open to the network, this
        # endpoint is a free relay to that provider for anyone who finds it —
        # which is exactly why the browser goes through the Node backend.
        response = post(client, authed=False)
        assert response.status_code == 401
        assert fake.calls == []


class TestOrdinaryTurn:
    def test_a_recording_comes_back_as_words(self, client, fake):
        response = post(client)
        assert response.status_code == 200
        body = response.json()
        assert body["transcript"] == "I need health cover for my parents"
        assert body["language"] == "en-IN"
        assert body["provider"] == "gemini"

    def test_the_body_reaches_the_service_byte_for_byte(self, client, fake):
        post(client)
        audio, mime, _ = fake.calls[0]
        # No re-encoding and no transcode step anywhere on this path.
        assert audio == WEBM
        assert mime == "audio/webm"

    def test_the_codec_parameter_survives_to_the_service(self, client, fake):
        post(client, content_type="audio/webm;codecs=opus")
        assert fake.calls[0][1].startswith("audio/webm")

    @pytest.mark.parametrize(
        "content_type,browser",
        [
            ("audio/webm", "Chrome, Edge, Brave"),
            ("audio/ogg", "Firefox"),
            ("audio/mp4", "Safari"),
        ],
    )
    def test_every_browser_container_is_accepted(self, client, fake, content_type, browser):
        assert post(client, content_type=content_type).status_code == 200, browser

    def test_a_language_hint_is_carried_but_bounded(self, client, fake):
        post(client, language="ta-IN")
        assert fake.calls[0][2] == "ta-IN"

        # The hint ends up in a prompt sent to a paid API, so its length is
        # capped rather than trusted.
        post(client, language="x" * 500)
        assert len(fake.calls[1][2]) <= 32

    def test_tamil_and_thanglish_come_back_exactly_as_spoken(self, client, fake):
        for transcript, language in [
            ("எனக்கு மருத்துவ காப்பீடு வேண்டும்", "ta-IN"),
            ("enakku family ku oru health policy venum", "ta-en"),
        ]:
            fake.result = Transcription(transcript=transcript, language=language, provider="gemini")
            body = post(client).json()
            # Nothing on this path translates or transliterates: the advisor's
            # existing language layer reads the transcript as it reads a typed
            # message, and rewriting it here would take that decision away.
            assert body["transcript"] == transcript
            assert body["language"] == language


class TestRefusals:
    def test_a_document_is_refused_before_the_service_is_touched(self, client, fake):
        response = post(client, content_type="application/pdf")
        assert response.status_code == 415
        assert fake.calls == []

    def test_a_missing_content_type_is_refused(self, client, fake):
        response = post(client, content_type="")
        assert response.status_code == 415
        assert fake.calls == []

    def test_an_oversized_body_is_refused_on_its_real_length(self, client, fake, monkeypatch):
        # `Content-Length` is a claim; the measured body is the fact.
        monkeypatch.setattr(stt.settings, "STT_MAX_BYTES", 1024)
        response = post(client, body=b"\x1a\x45\xdf\xa3" + b"\x00" * 4096)
        assert response.status_code == 413
        assert fake.calls == []


class TestFailureMapping:
    @pytest.mark.parametrize(
        "error,status",
        [
            (stt.SttEmptyAudio("silence"), 422),
            (stt.SttUnsupportedAudio("bad container"), 415),
            (stt.SttTimeout("too slow"), 504),
            (stt.SttNotConfigured("no key"), 503),
            (stt.SttUnsupportedProvider("no such provider"), 503),
            (stt.SttProviderFailure("refused"), 502),
        ],
    )
    def test_each_cause_gets_its_own_status(self, client, fake, error, status):
        fake.raises = error
        assert post(client).status_code == status

    def test_the_customer_gets_the_safe_sentence_not_the_internal_one(self, client, fake):
        fake.raises = stt.SttProviderFailure(
            "Gemini STT call failed: PermissionDenied: API key sk-live-abc is invalid"
        )
        detail = post(client).json()["detail"]
        assert "sk-live" not in detail and "Gemini" not in detail
        assert "type your question" in detail

    def test_an_unclassified_crash_never_leaks_a_traceback(self, client, fake):
        fake.raises = RuntimeError("/srv/app/services/stt_service.py line 214 exploded")
        response = post(client)
        assert response.status_code == 502
        assert "stt_service.py" not in response.json()["detail"]

    def test_silence_is_a_422_so_the_browser_can_say_speak_again(self, client, fake):
        # Not a 5xx. This is the one failure that must not push the customer
        # towards typing — they were simply too quiet, and can just try again.
        fake.raises = stt.SttEmptyAudio("no speech")
        assert post(client).status_code == 422
