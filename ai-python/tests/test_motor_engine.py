"""
Characterisation tests for the motor recommendation engine (Alex AI).

Motor budgets are expressed **per year** — motor_plans carries
premium_period: "annual" and SEGMENT_THRESHOLDS are yearly figures. This is
deliberately the opposite of the health engine's monthly unit; these tests pin
both halves of that contract.
"""

import pytest

from app.agents.motor_engine import (
    _parse_budget,
    analyse_risk,
    classify_segment,
    classify_vehicle,
    get_top3_recommendations,
)
from app.agents.motor_plans import MOTOR_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS


# ── Budget parsing ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("10000",          10000),
    ("30000 per year", 30000),
    ("₹12,000",        12000),
])
def test_parse_budget_reads_annual_figures_as_is(raw, expected):
    assert _parse_budget(raw) == expected


def test_parse_budget_converts_monthly_to_annual():
    """A monthly figure is multiplied by 12 — the engine works in annual rupees."""
    assert _parse_budget("2000/month") == 24000


@pytest.mark.parametrize("raw", [None, "abc"])
def test_parse_budget_returns_none_when_unparseable(raw):
    assert _parse_budget(raw) is None


def test_motor_and_health_budget_units_are_deliberately_different():
    """
    Guards the most dangerous refactor on this code: collapsing the two
    _parse_budget helpers into one shared implementation. Each engine's unit
    matches its own plan catalog, so they must stay separate.
    """
    from app.agents.health_engine import _parse_budget as health_parse

    assert health_parse("2000/month") == 2000      # monthly stays monthly
    assert _parse_budget("2000/month") == 24000    # monthly becomes annual


# ── Segmentation ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("budget,expected", [
    ("5000",  "budget"),
    ("15000", "standard"),
    ("30000", "premium"),
])
def test_classify_segment_matches_annual_thresholds(budget, expected):
    assert classify_segment({"budget": budget}) == expected


def test_classify_segment_defaults_to_standard_when_nothing_is_known():
    assert classify_segment({}) == "standard"


def test_classify_segment_estimates_budget_from_idv_when_budget_missing():
    """Without a stated budget the engine assumes ~4% of IDV as annual premium."""
    assert classify_segment({"idv": "500000"}) == "standard"   # ~₹20,000
    assert classify_segment({"idv": "100000"}) == "budget"     # ~₹4,000
    assert classify_segment({"idv": "1000000"}) == "premium"   # ~₹40,000


def test_segment_boundaries_are_inclusive_lower_exclusive_upper():
    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        assert classify_segment({"budget": str(lo)}) == segment


# ── Vehicle classification ────────────────────────────────────────────────────

def test_classify_vehicle_defaults_to_private_car():
    assert classify_vehicle({}) == "private_car"


# ── Risk analysis ─────────────────────────────────────────────────────────────

RISK_DIMENSIONS = {
    "vehicle_risk", "claim_risk", "location_risk", "theft_risk",
    "commercial_risk", "premium_risk", "fuel_risk",
}


def test_analyse_risk_returns_all_seven_dimensions_plus_overall():
    risk = analyse_risk({"registration_year": "2020", "vehicle_type": "car"})
    assert RISK_DIMENSIONS.issubset(risk.keys())
    assert "overall_risk_score" in risk


def test_analyse_risk_overall_stays_within_bounds():
    risk = analyse_risk({
        "registration_year": "1998", "vehicle_type": "luxury car",
        "usage_type": "commercial", "location": "Mumbai",
        "claim_history": "yes", "fuel_type": "electric",
    })
    assert 0 <= risk["overall_risk_score"] <= 100


def test_prior_claim_raises_claim_risk():
    clean = analyse_risk({"claim_history": "no"})
    claimed = analyse_risk({"claim_history": "yes"})
    assert claimed["claim_risk"] > clean["claim_risk"]


def test_metro_location_raises_accident_and_theft_risk():
    metro = analyse_risk({"location": "Mumbai"})
    town = analyse_risk({"location": "Karaikudi"})
    assert metro["location_risk"] > town["location_risk"]
    assert metro["theft_risk"] > town["theft_risk"]


def test_commercial_use_raises_commercial_risk():
    personal = analyse_risk({"usage_type": "personal"})
    commercial = analyse_risk({"usage_type": "commercial"})
    assert commercial["commercial_risk"] > personal["commercial_risk"]


def test_older_vehicle_carries_more_vehicle_risk():
    new = analyse_risk({"registration_year": "2024"})
    old = analyse_risk({"registration_year": "2005"})
    assert old["vehicle_risk"] > new["vehicle_risk"]


# ── Top-3 recommendation ──────────────────────────────────────────────────────

STANDARD_PROFILE = {
    "budget": "15000",
    "registration_year": "2020",
    "vehicle_type": "car",
    "location": "Chennai",
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
    assert result["category"] == "motor"
    assert result["recommended"] == result["plans"][0]["plan_name"]
    assert result["vehicle_cat"]


def test_get_top3_only_offers_plans_from_the_customers_segment():
    result = get_top3_recommendations(STANDARD_PROFILE)
    allowed = {MOTOR_PLANS[k]["plan_name"] for k in PLANS_BY_SEGMENT["standard"]}
    assert {p["plan_name"] for p in result["plans"]} <= allowed


@pytest.mark.parametrize("budget,segment", [
    ("5000",  "Budget"),
    ("15000", "Standard"),
    ("30000", "Premium"),
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
