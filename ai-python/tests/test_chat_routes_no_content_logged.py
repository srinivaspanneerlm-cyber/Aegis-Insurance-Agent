"""
`/api/ai/ai-chat`, `/api/ai`, and root `/ai-chat` must never log message content.

Found during the voice-safety audit: all three logged
`f"...'{request.message[:60]}...'"` on every request — the first 60 raw
characters of whatever the customer typed, unredacted, straight to
stdout/log aggregation. A customer's message can carry a medical condition,
an income or a family situation, and `app/services/stt_service.py` already
states and follows the opposite policy for a spoken turn's transcript
("Deliberately logs the shape of the turn and never its content"). Fixed to
match: all three now log only the character count.

No provider is called — `get_chat_service` is monkeypatched with a stub that
returns a canned result without touching the real orchestrator.
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.routes import chat_routes
from app.config.config import settings
import main

SENSITIVE = "I have diabetes and my monthly income is exactly 987654"


class FakeChatService:
    async def dispatch(self, message, history, user_name, product_type, session_id,
                        force_transfer_to=None, declined_domains=None, user_id=None):
        return {
            "reply": "Thanks, noted.",
            "agent_name": "Sarah AI",
            "agent_domain": "health",
            "session_id": session_id or "test-session",
        }


@pytest.fixture
def fake(monkeypatch):
    service = FakeChatService()
    monkeypatch.setattr(chat_routes, "get_chat_service", lambda: service)
    monkeypatch.setattr(main, "get_chat_service", lambda: service, raising=False)
    return service


@pytest.fixture
def client():
    return TestClient(main.app)


def _headers():
    """The internal service key, when this environment has one configured —
    mirrors what the real Node backend sends. `require_internal_auth` is a
    documented no-op when unset, so this is correct either way."""
    return {"X-Internal-Api-Key": settings.AI_INTERNAL_API_KEY} if settings.AI_INTERNAL_API_KEY else {}


@pytest.mark.parametrize("path", ["/api/ai/ai-chat", "/api/ai", "/ai-chat"])
def test_the_message_never_appears_in_any_log_record(path, client, fake, caplog):
    caplog.set_level("DEBUG")
    resp = client.post(path, json={"message": SENSITIVE, "user_name": "Test"}, headers=_headers())
    assert resp.status_code == 200

    for record in caplog.records:
        assert SENSITIVE not in record.getMessage()
        assert "diabetes" not in record.getMessage()
        assert "987654" not in record.getMessage()


@pytest.mark.parametrize("path", ["/api/ai/ai-chat", "/api/ai", "/ai-chat"])
def test_the_shape_is_still_logged_for_operability(path, client, fake, caplog):
    """The fix must not turn the log line into silence — only the content
    goes, the character count (useful for spotting empty/oversized turns in
    aggregate) stays."""
    caplog.set_level("INFO")
    resp = client.post(path, json={"message": SENSITIVE, "user_name": "Test"}, headers=_headers())
    assert resp.status_code == 200

    assert any(str(len(SENSITIVE)) in record.getMessage() for record in caplog.records)
