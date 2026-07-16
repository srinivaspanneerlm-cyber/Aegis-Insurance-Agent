"""
Characterisation tests for the health recommendation engine (Sarah AI).

Health budgets are expressed **per month** — the plan catalog's premium_min /
premium_max and SEGMENT_THRESHOLDS are all monthly figures. These tests pin
that contract so a refactor cannot silently switch the unit.
"""

import pytest

from app.agents.health_engine import (
    _parse_budget,
    analyse_risk,
    classify_segment,
    get_top3_recommendations,
)
from app.agents.health_plans import HEALTH_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS


# ── Budget parsing ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("2000",           2000),
    ("2000/month",     2000),
    ("2000 per month", 2000),
    ("₹2,000/month",   2000),
])
def test_parse_budget_reads_monthly_figures_as_is(raw, expected):
    assert _parse_budget(raw) == expected


@pytest.mark.parametrize("raw", ["24000 annual", "24000 per year"])
def test_parse_budget_converts_annual_to_monthly(raw):
    """An annual figure is divided by 12 — the engine works in monthly rupees."""
    assert _parse_budget(raw) == 2000


@pytest.mark.parametrize("raw", [None, "", "abc"])
def test_parse_budget_returns_none_when_unparseable(raw):
    assert _parse_budget(raw) is None


# ── Segmentation ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("budget,expected", [
    ("500",  "budget"),
    ("2000", "standard"),
    ("5000", "premium"),
])
def test_classify_segment_matches_monthly_thresholds(budget, expected):
    assert classify_segment({"budget": budget}) == expected


def test_classify_segment_defaults_to_budget_when_budget_missing():
    assert classify_segment({}) == "budget"


def test_segment_boundaries_are_inclusive_lower_exclusive_upper():
    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        assert classify_segment({"budget": str(lo)}) == segment
        if hi < 999999:
            assert classify_segment({"budget": str(hi)}) != segment


# ── Risk analysis ─────────────────────────────────────────────────────────────

RISK_DIMENSIONS = {
    "age_risk", "ped_risk", "family_risk", "lifestyle_risk", "location_risk",
    "financial_risk", "coverage_gap_risk", "network_risk", "claim_probability",
}


def test_analyse_risk_returns_all_nine_dimensions_plus_overall():
    risk = analyse_risk({"age": "35", "family_size": "4"})
    assert RISK_DIMENSIONS.issubset(risk.keys())
    assert "overall_risk_score" in risk


def test_analyse_risk_overall_stays_within_bounds():
    risk = analyse_risk({"age": "80", "family_size": "9",
                         "medical_history": "diabetes, heart", "lifestyle": "smoker"})
    assert 0 <= risk["overall_risk_score"] <= 100


def test_preexisting_condition_raises_ped_risk():
    healthy = analyse_risk({"age": "35", "medical_history": "none"})
    diabetic = analyse_risk({"age": "35", "medical_history": "diabetes"})
    assert diabetic["ped_risk"] > healthy["ped_risk"]


def test_smoking_raises_lifestyle_risk_above_active_lifestyle():
    smoker = analyse_risk({"age": "35", "lifestyle": "smoker"})
    active = analyse_risk({"age": "35", "lifestyle": "active gym"})
    assert smoker["lifestyle_risk"] > active["lifestyle_risk"]


def test_metro_location_lowers_hospital_access_risk():
    metro = analyse_risk({"age": "35", "location": "Chennai"})
    rural = analyse_risk({"age": "35", "location": "Karaikudi"})
    assert metro["location_risk"] < rural["location_risk"]


# ── Top-3 recommendation ──────────────────────────────────────────────────────

STANDARD_PROFILE = {
    "budget": "2000/month",
    "age": "35",
    "family_size": "4",
    "location": "Chennai",
    "medical_history": "diabetes",
}


def test_get_top3_returns_three_ranked_plans():
    result = get_top3_recommendations(STANDARD_PROFILE)
    assert result["total_plans"] == 3
    assert [p["rank"] for p in result["plans"]] == [1, 2, 3]


def test_get_top3_sorts_plans_by_descending_overall_score():
    result = get_top3_recommendations(STANDARD_PROFILE)
    scores = [p["scores"]["overall"] for p in result["plans"]]
    assert scores == sorted(scores, reverse=True)


def test_get_top3_envelope_shape_is_stable():
    result = get_top3_recommendations(STANDARD_PROFILE)
    assert result["type"] == "multi_plan"
    assert result["category"] == "health"
    assert result["recommended"] == result["plans"][0]["plan_name"]


def test_get_top3_only_offers_plans_from_the_customers_segment():
    result = get_top3_recommendations(STANDARD_PROFILE)
    allowed = {HEALTH_PLANS[k]["plan_name"] for k in PLANS_BY_SEGMENT["standard"]}
    assert {p["plan_name"] for p in result["plans"]} <= allowed


@pytest.mark.parametrize("budget,segment", [
    ("500/month",  "Budget"),
    ("2000/month", "Standard"),
    ("5000/month", "Premium"),
])
def test_get_top3_segment_label_follows_budget(budget, segment):
    result = get_top3_recommendations({**STANDARD_PROFILE, "budget": budget})
    assert result["segment"] == segment


def test_all_plan_scores_are_bounded_zero_to_hundred():
    result = get_top3_recommendations(STANDARD_PROFILE)
    for plan in result["plans"]:
        for dimension, value in plan["scores"].items():
            assert 0 <= value <= 100, f"{plan['plan_name']}.{dimension} = {value}"


def test_get_top3_works_on_an_empty_profile():
    """A cold-start profile must still yield a usable recommendation."""
    result = get_top3_recommendations({})
    assert result["total_plans"] == 3
    assert result["recommended"]


def test_every_plan_carries_its_advisory_narrative():
    result = get_top3_recommendations(STANDARD_PROFILE)
    for plan in result["plans"]:
        assert plan["why_this_plan"]
        assert plan["why_not_others"]
        assert plan["future_benefits"]
        assert plan["claim_experience"]


def test_reusing_a_supplied_risk_dict_does_not_change_ranking():
    risk = analyse_risk(STANDARD_PROFILE)
    passed_in = get_top3_recommendations(STANDARD_PROFILE, risk=risk)
    computed = get_top3_recommendations(STANDARD_PROFILE)
    assert passed_in["recommended"] == computed["recommended"]
