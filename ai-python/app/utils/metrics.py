"""
Application metrics for the AI reasoning path (Phase 8.2).

These are registered in the Prometheus default registry, so the existing
``/metrics`` endpoint in ``main.py`` exposes them automatically — no wiring
change. They cover the **non-streaming** reasoning path only: the REST chat
dispatch and the shared LLM provider layer. The protected SSE/voice streaming
path is deliberately left un-instrumented until sign-off.

Everything here is observation-only and defensive: a metrics failure must never
break a customer reply, so the recording helpers swallow their own errors.

Label cardinality is bounded on purpose — ``domain`` is normalised to the known
agent set, and providers/outcomes are a fixed vocabulary — so the series count
stays flat regardless of traffic.
"""
from __future__ import annotations

from prometheus_client import Counter, Histogram

from app.utils.logger import logger

# Latency buckets tuned for LLM-bound work: sub-second to tens of seconds.
_LATENCY_BUCKETS = (0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0)

# The domains an agent can carry a reply for; anything else collapses to "other"
# so a malformed label can never explode the series count.
_KNOWN_DOMAINS = {"health", "motor", "travel", "home-property", "property", "miscellaneous"}

DISPATCH_LATENCY = Histogram(
    "aegis_ai_dispatch_seconds",
    "End-to-end latency of a non-streaming chat dispatch through the orchestrator.",
    labelnames=("domain", "outcome"),
    buckets=_LATENCY_BUCKETS,
)

LLM_CALL_LATENCY = Histogram(
    "aegis_ai_llm_call_seconds",
    "Latency of a single LLM generate call, by provider.",
    labelnames=("provider", "outcome"),
    buckets=_LATENCY_BUCKETS,
)

LLM_TOKENS = Counter(
    "aegis_ai_llm_tokens_total",
    "LLM tokens consumed on the reasoning path, by provider and kind.",
    labelnames=("provider", "kind"),
)


def _domain(value: str | None) -> str:
    return value if value in _KNOWN_DOMAINS else "other"


def observe_dispatch(domain: str | None, outcome: str, seconds: float) -> None:
    """Record one orchestrator dispatch. ``outcome`` ∈ {success, fallback, error}."""
    try:
        DISPATCH_LATENCY.labels(domain=_domain(domain), outcome=outcome).observe(seconds)
    except Exception as e:  # pragma: no cover - metrics must never break a reply
        logger.debug(f"[metrics] observe_dispatch failed: {e}")


def observe_llm_call(provider: str | None, outcome: str, seconds: float) -> None:
    """Record one LLM generate call. ``outcome`` ∈ {success, error}."""
    try:
        LLM_CALL_LATENCY.labels(provider=provider or "unknown", outcome=outcome).observe(seconds)
    except Exception as e:  # pragma: no cover
        logger.debug(f"[metrics] observe_llm_call failed: {e}")


def record_llm_tokens(provider: str | None, prompt_tokens: int = 0, completion_tokens: int = 0) -> None:
    """Add provider-reported token usage. Silently ignores missing/zero counts."""
    try:
        p = provider or "unknown"
        if prompt_tokens:
            LLM_TOKENS.labels(provider=p, kind="prompt").inc(prompt_tokens)
        if completion_tokens:
            LLM_TOKENS.labels(provider=p, kind="completion").inc(completion_tokens)
    except Exception as e:  # pragma: no cover
        logger.debug(f"[metrics] record_llm_tokens failed: {e}")
