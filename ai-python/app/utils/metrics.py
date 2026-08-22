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

import functools
import sys
import time
from typing import Any, Callable, Dict, Iterable, List, Tuple

from prometheus_client import REGISTRY, Counter, Histogram
from prometheus_client.core import CounterMetricFamily

from app.utils.logger import logger

# Latency buckets tuned for LLM-bound work: sub-second to tens of seconds.
_LATENCY_BUCKETS = (0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0)

# Finer buckets for Layer-3 memory file I/O: sub-millisecond to a couple seconds.
_MEMORY_BUCKETS = (0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5)

# The domains an agent can carry a reply for; anything else collapses to "other"
# so a malformed label can never explode the series count.
_KNOWN_DOMAINS = {"health", "motor", "travel", "home-property", "property", "miscellaneous", "executive"}

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

# Time to first token, which is the number a customer actually experiences on
# the voice path: it is how long they sit in silence after they stop speaking.
# Separate from LLM_CALL_LATENCY, which measures the whole generation — the two
# used to be the same thing, and the point of streaming is that they are not.
LLM_STREAM_TTFT = Histogram(
    "aegis_ai_llm_stream_ttft_seconds",
    "Time from an LLM streaming call starting to its first token, by provider.",
    labelnames=("provider",),
    buckets=_LATENCY_BUCKETS,
)

LLM_TOKENS = Counter(
    "aegis_ai_llm_tokens_total",
    "LLM tokens consumed on the reasoning path, by provider and kind.",
    labelnames=("provider", "kind"),
)

MEMORY_OP_LATENCY = Histogram(
    "aegis_ai_memory_op_seconds",
    "Latency of a Layer-3 memory read/write op (conversation, profile, rec cache).",
    labelnames=("operation", "outcome"),
    buckets=_MEMORY_BUCKETS,
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


def observe_stream_ttft(provider: str | None, seconds: float) -> None:
    """Record how long a streamed turn took to say its first word."""
    try:
        LLM_STREAM_TTFT.labels(provider=provider or "unknown").observe(seconds)
    except Exception as e:  # pragma: no cover — metrics must never break a reply
        logger.debug(f"[metrics] observe_stream_ttft failed: {e}")


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


# ── Layer-3 memory-op timing (Phase 9.3b) ────────────────────────────────────
# The memory/persistence path is protected (CLAUDE.md §2), so this is strictly
# observation-only: it times an op and records the latency, then the op's result
# or exception passes through completely unchanged. A metrics failure can never
# affect a read or a write. Applied as a decorator so the method bodies are not
# touched. ``operation`` is a fixed vocabulary, so label cardinality stays flat.

def observe_memory_op(operation: str, outcome: str, seconds: float) -> None:
    """Record one memory op. ``outcome`` ∈ {success, error}."""
    try:
        MEMORY_OP_LATENCY.labels(operation=operation, outcome=outcome).observe(seconds)
    except Exception as e:  # pragma: no cover - metrics must never break persistence
        logger.debug(f"[metrics] observe_memory_op failed: {e}")


def timed_memory_op(operation: str) -> Callable:
    """Decorate a Layer-3 memory op to record its latency and outcome.

    Behaviour-preserving: the wrapped call's return value and any exception are
    propagated unchanged; timing is recorded in a ``finally`` so both paths are
    measured without altering control flow.
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.perf_counter()
            outcome = "success"
            try:
                return fn(*args, **kwargs)
            except Exception:
                outcome = "error"
                raise
            finally:
                observe_memory_op(operation, outcome, time.perf_counter() - start)
        return wrapper
    return decorator


# ── Agent-environment diagnostics (Phase 9.3) ────────────────────────────────
# Every AgentEnvironment already tracks live per-domain diagnostics on the
# request path (requests, errors, cache hits/misses, cumulative response time).
# This exposes them on /metrics *without* touching that path: a pull-based
# collector reads the diagnostics dataclass at scrape time only. Raw counters
# are exported (not pre-computed ratios) so cache-hit-rate, error-rate and mean
# latency are all derivable in PromQL and aggregate correctly across replicas.

EnvPairs = List[Tuple[str, Any]]  # (domain, AgentEnvironment)


def _iter_live_environments() -> EnvPairs:
    """Best-effort snapshot of every live agent environment, across the REST and
    stream orchestrators, deduped by identity.

    Read-only and fully defensive. It reads orchestrators from ``sys.modules``
    (never *imports* them) so a scrape can never boot an orchestrator as a side
    effect; any failure yields fewer — or zero — environments, never an
    exception that would break the scrape.
    """
    seen: set[int] = set()
    pairs: EnvPairs = []

    def _drain(registry: Any) -> None:
        try:
            for domain, env in registry.all_environments().items():
                if id(env) not in seen:
                    seen.add(id(env))
                    pairs.append((domain, env))
        except Exception as e:  # pragma: no cover - defensive
            logger.debug(f"[metrics] environment drain failed: {e}")

    # REST dispatch orchestrator (lazily created on the first chat request).
    try:
        chat_routes = sys.modules.get("app.routes.chat_routes")
        svc = getattr(chat_routes, "_chat_service", None) if chat_routes else None
        orch = getattr(svc, "_orchestrator", None) if svc else None
        if orch is not None:
            _drain(orch.registry)
    except Exception as e:  # pragma: no cover - defensive
        logger.debug(f"[metrics] REST orchestrator read failed: {e}")

    # Streaming orchestrator (module-level singleton, present only once imported).
    try:
        stream_service = sys.modules.get("app.services.stream_service")
        orch = getattr(stream_service, "_orchestrator", None) if stream_service else None
        if orch is not None:
            _drain(orch.registry)
    except Exception as e:  # pragma: no cover - defensive
        logger.debug(f"[metrics] stream orchestrator read failed: {e}")

    return pairs


class EnvironmentDiagnosticsCollector:
    """Pull-based Prometheus collector for per-environment diagnostics.

    Adds zero work to a customer reply: it only reads the counters that already
    exist on the request path, and only when Prometheus scrapes. It touches no
    orchestrator/agent/memory/stream *logic* — just a diagnostics dataclass.
    """

    def __init__(self, provider: Callable[[], EnvPairs] = _iter_live_environments):
        self._provider = provider

    def collect(self) -> Iterable[CounterMetricFamily]:
        reqs = CounterMetricFamily(
            "aegis_ai_env_requests", "Requests processed by an agent environment.",
            labels=["domain"])
        errs = CounterMetricFamily(
            "aegis_ai_env_errors", "Errors while processing in an agent environment.",
            labels=["domain"])
        hits = CounterMetricFamily(
            "aegis_ai_env_cache_hits", "Response-cache hits in an agent environment.",
            labels=["domain"])
        misses = CounterMetricFamily(
            "aegis_ai_env_cache_misses", "Response-cache misses in an agent environment.",
            labels=["domain"])
        rt = CounterMetricFamily(
            "aegis_ai_env_response_time_ms",
            "Cumulative in-environment response time (ms); divide by requests for the mean.",
            labels=["domain"])

        # Sum per domain first: the same domain can exist in more than one
        # orchestrator, and two lines with identical labels would break the
        # exposition. Keys are the registry's own bounded domain set.
        totals: Dict[str, Dict[str, float]] = {}
        try:
            pairs = self._provider() or []
        except Exception as e:  # pragma: no cover - defensive
            logger.debug(f"[metrics] environment provider failed: {e}")
            pairs = []

        for domain, env in pairs:
            d = getattr(env, "diagnostics", None)
            if d is None:
                continue
            t = totals.setdefault(
                _domain(domain),
                {"req": 0.0, "err": 0.0, "hit": 0.0, "miss": 0.0, "rt": 0.0},
            )
            t["req"] += getattr(d, "total_requests", 0) or 0
            t["err"] += getattr(d, "total_errors", 0) or 0
            t["hit"] += getattr(d, "cache_hits", 0) or 0
            t["miss"] += getattr(d, "cache_misses", 0) or 0
            t["rt"] += getattr(d, "total_response_time_ms", 0.0) or 0.0

        for dom, t in totals.items():
            reqs.add_metric([dom], t["req"])
            errs.add_metric([dom], t["err"])
            hits.add_metric([dom], t["hit"])
            misses.add_metric([dom], t["miss"])
            rt.add_metric([dom], t["rt"])

        yield reqs
        yield errs
        yield hits
        yield misses
        yield rt


_env_collector_registered = False


def register_environment_metrics(
    registry: Any = REGISTRY,
    provider: Callable[[], EnvPairs] | None = None,
) -> None:
    """Register the pull-based environment collector once. Idempotent so repeated
    imports (or a re-import in tests) never raise a duplicate-collector error."""
    global _env_collector_registered
    if _env_collector_registered:
        return
    try:
        registry.register(
            EnvironmentDiagnosticsCollector(provider or _iter_live_environments)
        )
        _env_collector_registered = True
    except Exception as e:  # pragma: no cover - defensive
        logger.debug(f"[metrics] environment collector registration failed: {e}")


# Register against the default registry at import (metrics.py is imported during
# app startup via the chat/LLM seams), so /metrics exposes the families with no
# wiring change — mirroring how the histograms/counters above self-register.
register_environment_metrics()
