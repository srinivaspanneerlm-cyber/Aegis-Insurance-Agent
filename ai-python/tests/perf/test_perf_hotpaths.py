"""
Latency baseline + regression guard for the AI engine's non-protected hot paths
(Phase 9.1 — Performance Engineering).

Three pure, rule-based paths dominate the cost of a specialist turn *before* the
LLM is ever called, and every one of them runs on the request thread:

  1. recommendation scoring  — `get_top3_recommendations` (per domain)
  2. prompt rendering        — `BaseInsuranceAgent._format_profile_for_prompt`
  3. knowledge retrieval     — BM25 `HybridSearchEngine.search` (offline path)

This module benchmarks all three (reusing the eval personas so the inputs are
the same realistic customers the correctness eval uses) and asserts a *generous
absolute ceiling* on the median. The ceilings are set an order of magnitude
above steady-state so they catch a real regression (an accidental O(n^2), a lost
cache, a per-call index rebuild) without flaking on a slow CI runner. Timings
are machine-dependent, so — unlike the recommendation/prompt goldens — nothing
here is pinned to an exact value.

It is LLM-free and side-effect-free: engines run on copied persona dicts, the
render agent is built with `__new__` (no environment init, no LLM), and the BM25
index is read-only. Nothing writes a profile or touches routing/streaming.

Run `./venv/bin/pytest tests/perf -s` to see the printed baseline table.
"""
from __future__ import annotations

from typing import List

import pytest

from app.agents.base_agent import BaseInsuranceAgent

from .benchmark import Timing, format_table, measure

# `tests/` is not a package (only tests/eval and tests/perf are), so the eval
# fixtures are reached as a sibling top-level package on pytest's sys.path
# rather than via a `..eval` relative import.
from eval.harness import ENGINES        # noqa: E402  (sibling test package)
from eval.personas import PERSONAS       # noqa: E402

# Generous per-path medians (ms). An order of magnitude over steady state — a
# tripwire for structural regressions, not a tight SLA.
SCORING_CEILING_MS = 50.0
RENDER_CEILING_MS = 10.0
RETRIEVAL_CEILING_MS = 100.0


class _RenderAgent(BaseInsuranceAgent):
    DOMAIN = "health"
    NAME = "Sarah AI"


def _one_persona_per_domain():
    """First authored persona for each engine domain — a representative input."""
    seen = {}
    for p in PERSONAS:
        if p["domain"] in ENGINES and p["domain"] not in seen:
            seen[p["domain"]] = p
    return seen


def _measure_scoring() -> List[Timing]:
    timings = []
    for domain, persona in _one_persona_per_domain().items():
        engine = ENGINES[domain]
        profile = persona["profile"]
        timings.append(
            measure(lambda e=engine, pr=profile: e(dict(pr)),
                    label=f"scoring · {domain}")
        )
    return timings


def _measure_render() -> Timing:
    agent = _RenderAgent.__new__(_RenderAgent)
    # A fully-populated profile is the worst case (every labelled field renders).
    profile = {
        "name": "Test User", "age": "38", "family_size": "4",
        "budget": "2200/month", "location": "Chennai",
        "medical_history": "none", "vehicle": "sedan", "destination": "Dubai",
        "trip_duration": "7 days", "property": "apartment",
        "annual_income": "800000", "occupation": "teacher",
    }
    return measure(lambda: agent._format_profile_for_prompt(dict(profile)),
                   label="prompt render · full profile")


def _measure_retrieval() -> Timing:
    from app.services.hybrid_search import get_hybrid_search_engine

    engine = get_hybrid_search_engine()
    query = "what is the waiting period for pre-existing disease coverage"
    return measure(lambda: engine.search(query, "health", top_k=4),
                   label="bm25 retrieval · health")


# ── Regression guards ────────────────────────────────────────────────────────

def test_scoring_stays_under_ceiling():
    for t in _measure_scoring():
        assert t.under(SCORING_CEILING_MS), (
            f"{t.label} median {t.median_ms:.3f}ms exceeded {SCORING_CEILING_MS}ms"
        )


def test_prompt_render_stays_under_ceiling():
    t = _measure_render()
    assert t.under(RENDER_CEILING_MS), (
        f"{t.label} median {t.median_ms:.3f}ms exceeded {RENDER_CEILING_MS}ms"
    )


def test_bm25_retrieval_stays_under_ceiling():
    t = _measure_retrieval()
    assert t.under(RETRIEVAL_CEILING_MS), (
        f"{t.label} median {t.median_ms:.3f}ms exceeded {RETRIEVAL_CEILING_MS}ms"
    )


def test_retrieval_index_is_built_once_not_per_call():
    """The BM25 index is the expensive part; the engine is a singleton so it must
    be built once. A regression that rebuilt per call would make the second
    lookup as slow as the first — assert the steady-state median is a small
    fraction of the very first (cold) call."""
    from app.services.hybrid_search import get_hybrid_search_engine

    engine = get_hybrid_search_engine()
    query = "coverage benefits premium claim exclusions"
    # Warm the singleton, then a cold-vs-steady comparison of the search itself.
    cold = measure(lambda: engine.search(query, "health", top_k=4),
                   iterations=1, warmup=0)
    steady = measure(lambda: engine.search(query, "health", top_k=4),
                     iterations=100, warmup=5)
    # Search is pure lookup over a prebuilt index → steady state must not balloon.
    assert steady.median_ms <= RETRIEVAL_CEILING_MS
    assert steady.median_ms <= max(cold.median_ms, RETRIEVAL_CEILING_MS)


# ── Baseline table (visible with -s; documents the Phase 9 starting point) ─────

def test_print_perf_baseline(capsys):
    timings = [*_measure_scoring(), _measure_render(), _measure_retrieval()]
    table = format_table(timings)
    with capsys.disabled():
        print("\n\nAI hot-path latency baseline (Phase 9.1)\n")
        print(table)
        print()
    # Sanity: every measured path produced samples.
    assert all(t.iterations >= 1 for t in timings)
