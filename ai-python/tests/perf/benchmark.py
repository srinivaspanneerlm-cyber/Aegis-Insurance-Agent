"""
A tiny, dependency-free micro-benchmark utility for the AI engine's hot paths.

Phase 9.1 (Performance Engineering) establishes a *latency* baseline the way
Phase 8.1 established a *correctness* baseline. It is deliberately kept
dependency-light — `pytest-benchmark` is not installed and the 8.4 precedent is
to add real capability without new deps — so this leans only on `time.perf_counter`.

Like the eval harness it is **LLM-free and side-effect-free**: callers wrap pure,
rule-based functions (scoring, prompt render, BM25 retrieval) on copied inputs,
so nothing here invokes an agent, writes a customer profile, or touches the
protected orchestrator / streaming paths.

The numbers are wall-clock and therefore *machine-dependent*. That is why perf
results are never pinned to a golden file (unlike the recommendation/prompt
baselines): a regression guard here asserts a generous absolute ceiling that
catches an order-of-magnitude slowdown, not a few-millisecond drift on a slower
CI runner.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from statistics import median
from typing import Callable, List


@dataclass(frozen=True)
class Timing:
    """A reduced view of many timed runs, all in milliseconds."""

    label: str
    iterations: int
    min_ms: float
    median_ms: float
    p95_ms: float
    mean_ms: float

    def under(self, ceiling_ms: float) -> bool:
        """True when the median stays under a regression ceiling. The median
        (not the mean or max) is the stable signal — a single GC pause or a
        noisy CI neighbour spikes the tail but not the middle."""
        return self.median_ms <= ceiling_ms


def _percentile(sorted_samples: List[float], pct: float) -> float:
    """Nearest-rank percentile over an already-sorted list (0..100)."""
    if not sorted_samples:
        return 0.0
    if len(sorted_samples) == 1:
        return sorted_samples[0]
    rank = max(1, round(pct / 100 * len(sorted_samples)))
    return sorted_samples[min(rank, len(sorted_samples)) - 1]


def measure(fn: Callable[[], object], *, iterations: int = 200, warmup: int = 10,
            label: str = "") -> Timing:
    """Run `fn` `iterations` times and reduce the per-call wall-clock to a Timing.

    A short warmup absorbs first-call costs (imports, lazy index builds, branch
    prediction) so the recorded samples reflect steady state.
    """
    for _ in range(max(0, warmup)):
        fn()

    samples: List[float] = []
    for _ in range(max(1, iterations)):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1000.0)

    samples.sort()
    return Timing(
        label=label,
        iterations=len(samples),
        min_ms=samples[0],
        median_ms=median(samples),
        p95_ms=_percentile(samples, 95),
        mean_ms=sum(samples) / len(samples),
    )


def format_table(timings: List[Timing]) -> str:
    """Render timings as a fixed-width table (all times in ms) for the report."""
    header = (f"{'hot path':<44}{'iters':>7}"
              f"{'min':>10}{'median':>10}{'p95':>10}{'mean':>10}   (ms)")
    rule = "-" * (len(header) - len("   (ms)"))
    rows = [
        f"{t.label:<44}{t.iterations:>7}"
        f"{t.min_ms:>10.3f}{t.median_ms:>10.3f}{t.p95_ms:>10.3f}{t.mean_ms:>10.3f}"
        for t in timings
    ]
    return "\n".join([header, rule, *rows])
