"""
The retry/timeout boundary around a paid LLM call.

Before this, Ollama and OpenAI calls had no explicit timeout (an SDK default,
often minutes) and no retry at all — one dropped connection ended the whole
turn. These tests exercise `_create_chat_completion` directly, with a fake
client, so no real network call or provider credential is needed.
"""
import asyncio
import httpx
import pytest

from openai import APITimeoutError
from app.services.llm_service import _create_chat_completion
from app.config.config import settings


def _timeout_error() -> APITimeoutError:
    # APITimeoutError only needs the request it was raised for; a real
    # network call is not required to construct one.
    request = httpx.Request("POST", "https://example.invalid/v1/chat/completions")
    return APITimeoutError(request)


class _FakeClient:
    """Stands in for AsyncOpenAI — only `.chat.completions.create` is used."""

    def __init__(self, side_effects):
        self.chat = self
        self.completions = self
        self._calls = 0
        self._side_effects = list(side_effects)

    async def create(self, **kwargs):
        effect = self._side_effects[self._calls]
        self._calls += 1
        if isinstance(effect, Exception):
            raise effect
        return effect


def test_a_transient_failure_is_retried_and_can_still_succeed():
    client = _FakeClient([_timeout_error(), "ok"])
    result = asyncio.run(_create_chat_completion(client, model="x", messages=[]))
    assert result == "ok"
    assert client._calls == 2


def test_the_retry_is_bounded_not_infinite():
    # Every attempt fails. However many retries LLM_CALL_MAX_ATTEMPTS allows,
    # the call must eventually raise rather than loop forever.
    attempts = settings.LLM_CALL_MAX_ATTEMPTS
    client = _FakeClient([_timeout_error() for _ in range(attempts + 5)])
    with pytest.raises(APITimeoutError):
        asyncio.run(_create_chat_completion(client, model="x", messages=[]))
    assert client._calls == attempts


def test_a_non_transient_error_is_not_retried():
    # A bad request or an unknown model will fail identically every time —
    # retrying only delays the safe fallback the caller is going to reach
    # anyway. A plain ValueError stands in for "not one of the recognised
    # transient exception types".
    client = _FakeClient([ValueError("model 'ghost' not found"), "ok"])
    with pytest.raises(ValueError):
        asyncio.run(_create_chat_completion(client, model="x", messages=[]))
    assert client._calls == 1


def test_a_clean_first_attempt_never_retries():
    client = _FakeClient(["ok"])
    result = asyncio.run(_create_chat_completion(client, model="x", messages=[]))
    assert result == "ok"
    assert client._calls == 1
