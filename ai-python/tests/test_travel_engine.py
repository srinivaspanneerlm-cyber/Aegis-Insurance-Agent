"""
Characterisation tests for the travel recommendation engine (Ethan AI).

Travel budgets are **per trip, per person** — no monthly/annual conversion
happens at all, which makes this the third distinct budget unit in the codebase
(health is monthly, motor and property are annual). Each engine's unit matches
its own plan catalog, so these must not be unified.
"""

import pytest

from app.agents.travel_engine import (
    _parse_budget,
    analyse_risk,
    classify_segment,
    classify_travel_type,
    get_top3_recommendations,
)
from app.agents.travel_plans import PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS, TRAVEL_PLANS


# ── Budget parsing ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("2000",     2000),
    ("₹3,000",   3000),
    ("1.5 lakh", 150_000),
    ("2 lakh",   200_000),
])
def test_parse_budget_reads_per_trip_figures(raw, expected):
    assert _parse_budget(raw) == expected


@pytest.mark.parametrize("raw", [None, "abc"])
def test_parse_budget_returns_none_when_unparseable(raw):
    assert _parse_budget(raw) is None


def test_travel_budget_is_per_trip_not_a_period_rate():
    """
    Unlike health (monthly) and motor/property (annual), a travel budget is a
    one-off per-trip figure — a "/month" suffix must not scale it.
    """
    assert _parse_budget("2000") == 2000
    assert _parse_budget("2000/month") == 2000


# ── Segmentation ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("budget,expected", [
    ("500",  "budget"),
    ("2000", "standard"),
    ("8000", "premium"),
])
def test_classify_segment_matches_per_trip_thresholds(budget, expected):
    assert classify_segment({"budget": budget}) == expected


def test_classify_segment_defaults_to_budget_when_budget_missing():
    assert classify_segment({}) == "budget"


def test_segment_lower_bounds_are_inclusive():
    for segment, (lo, _hi) in SEGMENT_THRESHOLDS.items():
        assert classify_segment({"budget": str(lo)}) == segment


# ── Travel type ───────────────────────────────────────────────────────────────

def test_classify_travel_type_detects_business_from_purpose():
    assert classify_travel_type({"destination": "Dubai", "purpose": "business"}) == "business"


def test_classify_travel_type_defaults_to_international():
    assert classify_travel_type({}) == "international"


# ── Risk analysis ─────────────────────────────────────────────────────────────

RISK_DIMENSIONS = {
    "destination_risk", "medical_risk", "trip_cancellation_risk", "adventure_risk",
    "evacuation_risk", "flight_delay_risk", "lost_baggage_risk", "passport_risk",
}


def test_analyse_risk_returns_every_dimension_plus_overall():
    risk = analyse_risk({"destination": "Paris", "traveller_ages": "35"})
    assert RISK_DIMENSIONS.issubset(risk.keys())
    assert "overall_risk_score" in risk


def test_analyse_risk_overall_stays_within_bounds():
    risk = analyse_risk({
        "destination": "Afghanistan", "traveller_ages": "78",
        "medical_conditions": "diabetes, heart", "purpose": "trekking expedition",
        "trip_cost": "5 lakh",
    })
    assert 0 <= risk["overall_risk_score"] <= 100


def test_destination_risk_is_tiered_by_country():
    """War-zone > unknown default > established low-risk destination."""
    assert analyse_risk({"destination": "Afghanistan"})["destination_risk"] == 9.0
    assert analyse_risk({"destination": "Zzzland"})["destination_risk"] == 4.5
    assert analyse_risk({"destination": "USA"})["destination_risk"] == 2.5


def test_senior_traveller_raises_medical_risk():
    senior = analyse_risk({"traveller_ages": "70"})
    young = analyse_risk({"traveller_ages": "25"})
    assert senior["medical_risk"] > young["medical_risk"]


def test_preexisting_conditions_raise_medical_risk():
    ill = analyse_risk({"medical_conditions": "diabetes"})
    well = analyse_risk({"medical_conditions": "none"})
    assert ill["medical_risk"] > well["medical_risk"]


def test_adventure_purpose_raises_adventure_risk():
    adventurous = analyse_risk({"purpose": "trekking and scuba diving"})
    sightseeing = analyse_risk({"purpose": "sightseeing"})
    assert adventurous["adventure_risk"] > sightseeing["adventure_risk"]


def test_risk_summary_exposes_the_flags_the_advisor_narrates():
    risk = analyse_risk({"traveller_ages": "70", "destination": "USA"})
    assert risk["_has_senior"] is True
    assert risk["_is_international"] is True


# ── Top-3 recommendation ──────────────────────────────────────────────────────

STANDARD_PROFILE = {
    "budget": "2000",
    "destination": "Paris",
    "num_travellers": "2",
    "trip_cost": "150000",
    "traveller_ages": "35",
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
    assert result["category"] == "travel"
    assert result["recommended"] == result["plans"][0]["plan_name"]
    assert result["travel_type"]
    assert result["destination"]


def test_get_top3_only_offers_plans_from_the_customers_segment():
    result = get_top3_recommendations(STANDARD_PROFILE)
    allowed = {TRAVEL_PLANS[k]["plan_name"] for k in PLANS_BY_SEGMENT["standard"]}
    assert {p["plan_name"] for p in result["plans"]} <= allowed


@pytest.mark.parametrize("budget,segment", [
    ("500",  "Budget"),
    ("2000", "Standard"),
    ("8000", "Premium"),
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
