"""
The AI-response contract, at the boundary that actually matters.

`_result_to_response` turns whatever `central_orchestrator.dispatch()` returned
into the `ChatResponse` the Node backend and the frontend both depend on. Every
field is read with `.get(key, default)`, which is what already makes this safe
against a missing key — but nothing previously proved that, so a future edit
that swapped a `.get` for `result["key"]` (KeyError on the first incomplete
result) would have shipped unnoticed. These tests pin the existing, correct
behaviour rather than fix a defect — there wasn't one, but there was no test
saying so either.
"""
from app.routes.chat_routes import _result_to_response
from app.models.schemas import ChatResponse


def test_a_fully_populated_result_round_trips():
    result = {
        "reply": "Here is your plan.",
        "agent_name": "Sarah AI",
        "agent_domain": "health",
        "transferred": False,
        "suggest_transfer": False,
        "is_interrupt": False,
        "transfer_from": None,
        "transfer_from_name": None,
        "transfer_to": None,
        "transfer_to_name": None,
        "transfer_reason": None,
        "previous_agent": None,
        "session_id": "sess-123",
    }
    response = _result_to_response(result)
    assert isinstance(response, ChatResponse)
    assert response.reply == "Here is your plan."
    assert response.agent_name == "Sarah AI"


def test_a_completely_empty_result_does_not_raise():
    # The degenerate case: whatever produced this dict gave nothing at all.
    # A KeyError or a Pydantic ValidationError here would surface as an
    # unhandled 500 to a customer mid-conversation.
    response = _result_to_response({})
    assert isinstance(response, ChatResponse)
    assert response.reply == ""
    assert response.transferred is False
    assert response.suggest_transfer is False


def test_a_result_missing_only_the_optional_fields_still_builds():
    response = _result_to_response({"reply": "Hi"})
    assert response.reply == "Hi"
    assert response.agent_name is None
    assert response.session_id is None


def test_extra_unexpected_keys_are_ignored_not_fatal():
    # env_metadata (and similar) ride along on some internal result dicts but
    # are not part of the public contract — their presence must never break
    # construction of the response that is.
    result = {"reply": "ok", "env_metadata": {"fast_router": True}, "made_up_field": 42}
    response = _result_to_response(result)
    assert response.reply == "ok"
