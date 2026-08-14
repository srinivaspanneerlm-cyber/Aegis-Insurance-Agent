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
from app.services.llm_service import _create_chat_completion, LLMService
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


# ── The provider chain ────────────────────────────────────────────────────────
#
# One hosted provider is a single point of failure: when it rate limits or its
# endpoint is unreachable, the customer's turn dies. These tests pin the
# behaviour that keeps the conversation alive — the next provider answers the
# same turn, with the same history, and the customer is never told.


def _service_with_chain(chain, calls):
    """An LLMService whose providers are replaced by recorded fakes.

    Constructed without __init__ so no real client is built and no credential
    is needed; only the chain and the dispatch it drives are under test.
    """
    service = LLMService.__new__(LLMService)
    service.chain = list(chain)
    service.provider = chain[0]

    async def fake_dispatch(provider, system_prompt, user_message, history, tools):
        calls.append((provider, system_prompt, user_message, history))
        effect = behaviour[provider]
        if isinstance(effect, Exception):
            raise effect
        if callable(effect):
            return await effect()
        return effect

    behaviour = {}
    service._dispatch = fake_dispatch
    return service, behaviour


def test_a_failed_primary_falls_through_to_the_next_provider():
    calls = []
    service, behaviour = _service_with_chain(["ollama", "gemini"], calls)
    behaviour["ollama"] = RuntimeError("ollama.com unreachable")
    behaviour["gemini"] = "the fallback answered"

    reply = asyncio.run(service.generate_response("sys", "enakku health insurance venum"))

    assert reply == "the fallback answered"
    assert [c[0] for c in calls] == ["ollama", "gemini"]


def test_the_fallback_answers_the_same_turn_with_the_same_history():
    # The whole point: the customer asked one question, and whoever answers it
    # must have the conversation that led to it. A fallback that started cold
    # would reply to a stranger.
    calls = []
    service, behaviour = _service_with_chain(["ollama", "gemini"], calls)
    behaviour["ollama"] = RuntimeError("rate limited")
    behaviour["gemini"] = "ok"
    history = [{"sender": "customer", "message": "car insurance-um venuma?"}]

    asyncio.run(service.generate_response("sys-prompt", "budget 15k", history=history))

    primary, fallback = calls
    assert fallback[1:] == primary[1:] == ("sys-prompt", "budget 15k", history)


def test_a_healthy_primary_never_reaches_the_fallback():
    calls = []
    service, behaviour = _service_with_chain(["ollama", "gemini"], calls)
    behaviour["ollama"] = "primary answered"
    behaviour["gemini"] = "should not be called"

    reply = asyncio.run(service.generate_response("sys", "hi"))

    assert reply == "primary answered"
    assert [c[0] for c in calls] == ["ollama"]


def test_a_hanging_primary_is_abandoned_so_the_fallback_still_has_time(monkeypatch):
    # A provider that hangs is worse than one that fails: without a deadline it
    # eats the budget the backend gave the whole turn, and the fallback never
    # gets asked at all.
    monkeypatch.setattr(settings, "LLM_PROVIDER_BUDGET_SECONDS", 0.05)
    calls = []
    service, behaviour = _service_with_chain(["ollama", "gemini"], calls)

    async def hang():
        await asyncio.sleep(30)

    behaviour["ollama"] = hang
    behaviour["gemini"] = "the fallback answered"

    reply = asyncio.run(service.generate_response("sys", "hi"))

    assert reply == "the fallback answered"


def test_the_last_provider_runs_without_a_deadline(monkeypatch):
    # The deadline exists to leave room for whoever is next. On the last
    # provider there is no one next, so cutting it short would only turn a slow
    # answer into no answer.
    monkeypatch.setattr(settings, "LLM_PROVIDER_BUDGET_SECONDS", 0.05)
    calls = []
    service, behaviour = _service_with_chain(["gemini"], calls)

    async def slow():
        await asyncio.sleep(0.2)
        return "slow but real"

    behaviour["gemini"] = slow

    assert asyncio.run(service.generate_response("sys", "hi")) == "slow but real"


def test_when_every_provider_fails_the_last_error_is_raised():
    # Not swallowed into a cheerful empty string: the caller above this has its
    # own honest "I could not answer that" path, and it can only run if the
    # failure actually reaches it.
    calls = []
    service, behaviour = _service_with_chain(["ollama", "gemini"], calls)
    behaviour["ollama"] = RuntimeError("primary down")
    behaviour["gemini"] = ValueError("fallback down too")

    with pytest.raises(ValueError, match="fallback down too"):
        asyncio.run(service.generate_response("sys", "hi"))
    assert [c[0] for c in calls] == ["ollama", "gemini"]


# ── Chain construction ────────────────────────────────────────────────────────


def test_a_fallback_without_credentials_is_left_out_of_the_chain(monkeypatch):
    # A keyless provider fails on every attempt. Keeping it in the chain would
    # spend the customer's turn discovering that.
    monkeypatch.setattr(settings, "DEFAULT_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_FALLBACK_PROVIDERS", "gemini,openai")

    assert settings.provider_chain == ["ollama"]


def test_a_fallback_with_a_key_joins_the_chain_in_order(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_FALLBACK_PROVIDERS", "gemini,openai")

    assert settings.provider_chain == ["ollama", "gemini"]


def test_the_active_provider_is_never_repeated_as_its_own_fallback(monkeypatch):
    # Asking the provider that just failed to cover for itself is not a
    # fallback; it is the same failure a second time.
    monkeypatch.setattr(settings, "DEFAULT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "LLM_FALLBACK_PROVIDERS", "gemini,openai")

    assert settings.provider_chain == ["gemini", "openai"]
