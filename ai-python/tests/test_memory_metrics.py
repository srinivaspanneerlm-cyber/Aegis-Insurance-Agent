"""
Layer-3 memory-op timing (Phase 9.3b).

The memory/persistence path is protected, so the instrumentation is strictly
observation-only: it records latency and must never change a read/write's result
or swallow its error. These tests assert exactly that — plus that a metrics
failure can't break the op — and confirm a real decorated store method records.
"""
import pytest

from prometheus_client import REGISTRY

from app.utils import metrics
from app.utils.metrics import timed_memory_op


def _count(operation: str, outcome: str) -> float:
    return REGISTRY.get_sample_value(
        "aegis_ai_memory_op_seconds_count",
        {"operation": operation, "outcome": outcome},
    ) or 0.0


def test_observe_memory_op_records_one_observation():
    before = _count("unit_probe", "success")
    metrics.observe_memory_op("unit_probe", "success", 0.001)
    assert _count("unit_probe", "success") == before + 1


def test_decorator_times_success_and_returns_the_value():
    @timed_memory_op("decorated_ok")
    def double(x):
        return x * 2

    before = _count("decorated_ok", "success")
    assert double(21) == 42
    assert _count("decorated_ok", "success") == before + 1


def test_decorator_records_error_and_reraises():
    @timed_memory_op("decorated_boom")
    def boom():
        raise ValueError("nope")

    before = _count("decorated_boom", "error")
    with pytest.raises(ValueError):
        boom()
    assert _count("decorated_boom", "error") == before + 1


def test_decorator_preserves_function_metadata():
    @timed_memory_op("meta")
    def documented(a, b):
        "adds two numbers"
        return a + b

    assert documented.__name__ == "documented"
    assert "adds two numbers" in (documented.__doc__ or "")


def test_metrics_failure_never_breaks_the_op(monkeypatch):
    def explode(*a, **k):
        raise RuntimeError("registry exploded")

    monkeypatch.setattr(metrics.MEMORY_OP_LATENCY, "labels", explode)

    @timed_memory_op("resilient")
    def op():
        return "ok"

    # The recording blows up internally but the op still returns normally.
    assert op() == "ok"


def test_real_conversation_load_is_timed_and_unchanged(tmp_path):
    from app.memory.conversation_store import ConversationStore

    store = ConversationStore(tmp_path)
    before = _count("conversation_load", "success")
    # No file on disk yet → the contract is an empty list; timing must not alter it.
    result = store.load_history("cust_probe", "health")
    assert result == []
    assert _count("conversation_load", "success") == before + 1
