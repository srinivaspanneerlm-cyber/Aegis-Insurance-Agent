"""
Quality invariants that must hold for *every* customer, on *every* engine.

Unlike the per-engine characterisation tests, this drives all four specialists
(Sarah/Alex/Ethan/Emma) through one shared persona catalogue and asserts the
properties that define a trustworthy recommendation: a stable envelope, bounded
scores, an honestly-ranked list, determinism, a real advisory narrative on every
plan, and no mutation of the customer's profile. If a future change breaks any of
these for any persona, this fails — regardless of wording.
"""
from __future__ import annotations

import copy

import pytest

from .harness import SCORE_DIMENSIONS, SEGMENT_RANK, recommend, summarise
from .personas import BUDGET_ORDER, PERSONAS

ALL = [pytest.param(p, id=p["id"]) for p in PERSONAS]


@pytest.mark.parametrize("persona", ALL)
def test_envelope_contract_is_stable(persona):
    env = recommend(persona["domain"], persona["profile"])
    assert env["type"] == "multi_plan"
    assert env["category"] == persona["domain"]
    assert env["total_plans"] == 3
    assert len(env["plans"]) == 3
    assert [p["rank"] for p in env["plans"]] == [1, 2, 3]
    assert env["recommended"] == env["plans"][0]["plan_name"]


@pytest.mark.parametrize("persona", ALL)
def test_all_scores_are_bounded_0_to_100(persona):
    env = recommend(persona["domain"], persona["profile"])
    for plan in env["plans"]:
        assert set(plan["scores"]) == SCORE_DIMENSIONS
        for dim, value in plan["scores"].items():
            assert 0 <= value <= 100, f"{persona['id']} {plan['plan_name']}.{dim} = {value}"


@pytest.mark.parametrize("persona", ALL)
def test_plans_are_ranked_by_descending_overall(persona):
    env = recommend(persona["domain"], persona["profile"])
    overalls = [p["scores"]["overall"] for p in env["plans"]]
    assert overalls == sorted(overalls, reverse=True)
    assert env["plans"][0]["scores"]["overall"] == max(overalls)


@pytest.mark.parametrize("persona", ALL)
def test_recommendation_is_deterministic(persona):
    a = summarise(recommend(persona["domain"], persona["profile"]))
    b = summarise(recommend(persona["domain"], persona["profile"]))
    assert a == b


@pytest.mark.parametrize("persona", ALL)
def test_every_plan_carries_an_advisory_narrative(persona):
    env = recommend(persona["domain"], persona["profile"])
    for plan in env["plans"]:
        for field in ("why_this_plan", "future_benefits", "claim_experience", "benefits"):
            assert plan.get(field), f"{persona['id']} {plan['plan_name']} missing {field}"


@pytest.mark.parametrize("persona", ALL)
def test_engine_does_not_mutate_the_customer_profile(persona):
    before = copy.deepcopy(persona["profile"])
    recommend(persona["domain"], persona["profile"])
    assert persona["profile"] == before, "the engine must treat the profile as read-only"


def test_segment_rises_monotonically_with_budget():
    """Within a domain, a bigger budget must never land a customer in a lower
    segment tier — the plan tier should track ability to pay, not fight it."""
    by_domain: dict[str, dict[str, str]] = {}
    for p in PERSONAS:
        if p["tier"] is None:
            continue
        env = recommend(p["domain"], p["profile"])
        by_domain.setdefault(p["domain"], {})[p["tier"]] = env["segment"]

    for domain, tiers in by_domain.items():
        labels = [tiers[t] for t in BUDGET_ORDER if t in tiers]
        ranks = [SEGMENT_RANK[label] for label in labels]
        # Non-decreasing: a higher budget may keep the same tier, never drop one.
        assert ranks == sorted(ranks), f"{domain}: segment fell as budget rose → {labels}"
