"""
Two invariants from Phase 8 security work, pinned so they cannot regress
silently: an AI-engine failure never echoes its own exception text back to a
client, and no live code path ever hands the model a non-empty tool list.
"""
import asyncio
import pytest

from fastapi import HTTPException

from app.routes import chat_routes
from app.models.schemas import ChatRequest


class _RaisingService:
    """A fake ChatService whose dispatch() always fails with a sensitive detail."""

    async def dispatch(self, *args, **kwargs):
        raise RuntimeError(
            "connection to postgres://aegis:s3cr3t-db-password@10.0.0.5/prod failed"
        )


def _request(**overrides) -> ChatRequest:
    defaults = {"message": "hello"}
    defaults.update(overrides)
    return ChatRequest(**defaults)


@pytest.mark.parametrize(
    "endpoint",
    [chat_routes.chat_endpoint, chat_routes.direct_integration_endpoint],
)
def test_an_ai_engine_failure_never_echoes_its_own_exception_text(monkeypatch, endpoint):
    monkeypatch.setattr(chat_routes, "get_chat_service", lambda: _RaisingService())

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(endpoint(_request()))

    detail = str(exc_info.value.detail)
    assert detail == "Internal server error."
    # The actual assertion: whatever the real failure said — a connection
    # string, a password, a file path — none of it reaches the response.
    assert "s3cr3t-db-password" not in detail
    assert "postgres://" not in detail


def test_no_live_code_path_hands_the_model_a_non_empty_tool_list():
    """
    Pins the Task 8.5 finding: `calculate_premium` exists but is unreachable —
    every real caller passes tools=[]. If this ever changes, the checklist in
    AI_AGENTS.md §12.3 (permissions, authorization, auditability — all
    currently "None", correctly, only because nothing is reachable) needs to
    be revisited before the change ships, not after.
    """
    import inspect
    import app.agents.base_agent as base_agent_module
    import app.agents.executive_ai as executive_ai_module

    for module in (base_agent_module, executive_ai_module):
        source = inspect.getsource(module)
        assert "tools=[]" in source, (
            f"{module.__name__} no longer passes tools=[] to the LLM — "
            "tool-calling may have gone live without its authorization, "
            "tenant-scoping and audit gaps being closed first (see "
            "AI_AGENTS.md §12.3-12.4)."
        )
