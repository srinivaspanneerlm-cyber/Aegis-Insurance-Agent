"""
Tests for the AI reasoning metrics (Phase 8.2).

These assert the instrumentation *records* — deltas on the Prometheus default
registry — without invoking a real LLM. The dispatch tests drive the real
ChatService seam with a fake orchestrator, so no agent runs, no profile is
written, and the protected streaming path is never touched.
"""
import asyncio

from prometheus_client import REGISTRY

from app.services.chat_service import ChatService
from app.utils import metrics


def _dispatch_count(domain: str, outcome: str) -> float:
    return REGISTRY.get_sample_value(
        "aegis_ai_dispatch_seconds_count", {"domain": domain, "outcome": outcome}
    ) or 0.0


def _llm_count(provider: str, outcome: str) -> float:
    return REGISTRY.get_sample_value(
        "aegis_ai_llm_call_seconds_count", {"provider": provider, "outcome": outcome}
    ) or 0.0


def _tokens(provider: str, kind: str):
    return REGISTRY.get_sample_value(
        "aegis_ai_llm_tokens_total", {"provider": provider, "kind": kind}
    )


# ── metric helpers ────────────────────────────────────────────────────────────

def test_observe_dispatch_records_one_observation():
    before = _dispatch_count("health", "success")
    metrics.observe_dispatch("health", "success", 0.01)
    assert _dispatch_count("health", "success") == before + 1


def test_observe_dispatch_normalises_unknown_domain_to_other():
    before = _dispatch_count("other", "success")
    metrics.observe_dispatch("not-a-real-domain", "success", 0.01)
    assert _dispatch_count("other", "success") == before + 1


def test_observe_llm_call_records_by_provider():
    before = _llm_count("ollama", "success")
    metrics.observe_llm_call("ollama", "success", 0.5)
    assert _llm_count("ollama", "success") == before + 1


def test_record_llm_tokens_counts_prompt_and_completion():
    before_p = _tokens("openai", "prompt") or 0.0
    before_c = _tokens("openai", "completion") or 0.0
    metrics.record_llm_tokens("openai", 100, 40)
    assert _tokens("openai", "prompt") == before_p + 100
    assert _tokens("openai", "completion") == before_c + 40


def test_record_llm_tokens_ignores_zero_counts():
    # A provider/kind never incremented has no series at all.
    metrics.record_llm_tokens("zzz-unused-provider", 0, 0)
    assert _tokens("zzz-unused-provider", "prompt") is None


# ── dispatch seam ─────────────────────────────────────────────────────────────

class _FakeOrchestrator:
    async def dispatch(self, **kwargs):
        return {
            "agent_name": "Sarah AI", "agent_domain": "health", "reply": "hi",
            "transferred": False, "suggest_transfer": False,
        }


class _BoomOrchestrator:
    async def dispatch(self, **kwargs):
        raise RuntimeError("orchestrator down")


def _service_with(orchestrator):
    svc = ChatService.__new__(ChatService)  # skip heavy __init__
    svc._orchestrator = orchestrator
    return svc


def test_dispatch_records_success_outcome():
    svc = _service_with(_FakeOrchestrator())
    before = _dispatch_count("health", "success")
    result = asyncio.run(svc.dispatch("hello"))
    assert result["reply"] == "hi"
    assert _dispatch_count("health", "success") == before + 1


def test_dispatch_records_fallback_when_orchestrator_absent():
    svc = _service_with(None)
    before = _dispatch_count("health", "fallback")
    result = asyncio.run(svc.dispatch("hello", product_type="health"))
    assert "Aegis AI" in result["reply"]
    assert _dispatch_count("health", "fallback") == before + 1


def test_dispatch_records_error_then_still_replies():
    svc = _service_with(_BoomOrchestrator())
    before = _dispatch_count("health", "error")
    result = asyncio.run(svc.dispatch("hello", product_type="health"))
    assert result["agent_domain"] == "health"  # fallback reply still returned
    assert _dispatch_count("health", "error") == before + 1
