"""
Characterisation tests for the property recommendation engine (Emma AI).

Property budgets are **annual**, and unlike the other engines this one also
understands crore. Its risk model is the widest in the codebase: nine
independent peril dimensions (fire, flood, earthquake, storm, theft,
electrical, water, location, construction).
"""

import pytest

from app.agents.property_engine import (
    _parse_budget,
    analyse_risk,
    classify_property,
    classify_segment,
    get_top3_recommendations,
)
from app.agents.property_plans import PLANS_BY_SEGMENT, PROPERTY_PLANS, SEGMENT_THRESHOLDS


# ── Budget parsing ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("5000",     5000),
    ("₹12,000",  12000),
    ("1.5 lakh", 150_000),
    ("2 crore",  20_000_000),
])
def test_parse_budget_reads_annual_figures(raw, expected):
    assert _parse_budget(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("5000/month",       60_000),      # plain-digit branch
    ("1.5 lakh/month",   1_800_000),   # lakh branch
    ("2 lakh per month", 2_400_000),   # lakh branch, spelled-out suffix
])
def test_parse_budget_converts_monthly_to_annual(raw, expected):
    """
    A monthly figure is multiplied by 12 — the engine works in annual rupees.
    Plain digits and lakh are separate code paths, so both are exercised.
    """
    assert _parse_budget(raw) == expected


def test_crore_budgets_ignore_the_monthly_suffix():
    """
    Pins a real inconsistency: the crore branch returns before the monthly
    check, so "2 crore/month" is read as ₹2cr/year while "2 lakh/month"
    correctly becomes ₹24L/year. Harmless in practice — no property premium is
    quoted per month in crores — but a shared _parse_budget would have to
    preserve or deliberately fix it.
    """
    assert _parse_budget("2 crore/month") == 20_000_000
    assert _parse_budget("2 crore") == 20_000_000


@pytest.mark.parametrize("raw", [None, "abc"])
def test_parse_budget_returns_none_when_unparseable(raw):
    assert _parse_budget(raw) is None


def test_property_understands_crore_where_travel_does_not():
    """Property values run to crores; the travel engine has no crore handling."""
    from app.agents.travel_engine import _parse_budget as travel_parse

    assert _parse_budget("2 crore") == 20_000_000
    assert travel_parse("2 crore") == 2


# ── Segmentation ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("budget,expected", [
    ("3000",  "budget"),
    ("10000", "standard"),
    ("30000", "premium"),
])
def test_classify_segment_matches_annual_thresholds(budget, expected):
    assert classify_segment({"budget": budget}) == expected


def test_classify_segment_defaults_to_standard_when_budget_missing():
    assert classify_segment({}) == "standard"


def test_segment_lower_bounds_are_inclusive():
    for segment, (lo, _hi) in SEGMENT_THRESHOLDS.items():
        assert classify_segment({"budget": str(lo)}) == segment


# ── Property classification ───────────────────────────────────────────────────

@pytest.mark.parametrize("prop_type,expected", [
    ("apartment", "apartment"),
    ("villa",     "villa"),
])
def test_classify_property_reads_the_stated_type(prop_type, expected):
    assert classify_property({"property_type": prop_type}) == expected


def test_classify_property_defaults_to_apartment():
    assert classify_property({}) == "apartment"


# ── Risk analysis ─────────────────────────────────────────────────────────────

RISK_DIMENSIONS = {
    "fire_risk", "flood_risk", "earthquake_risk", "storm_risk", "theft_risk",
    "electrical_damage_risk", "water_leakage_risk", "location_risk",
    "construction_risk",
}


def test_analyse_risk_returns_all_nine_perils_plus_overall():
    risk = analyse_risk({"property_type": "apartment", "location": "Chennai"})
    assert RISK_DIMENSIONS.issubset(risk.keys())
    assert "overall_risk_score" in risk


def test_analyse_risk_overall_stays_within_bounds():
    risk = analyse_risk({
        "property_type": "factory", "location": "Guwahati",
        "property_age": "45", "construction_type": "wood",
        "security_system": "none", "property_value": "5 crore",
    })
    assert 0 <= risk["overall_risk_score"] <= 100


def test_old_wooden_construction_raises_fire_risk():
    old_wood = analyse_risk({"property_age": "40", "construction_type": "wood"})
    new_rcc = analyse_risk({"property_age": "2", "construction_type": "rcc"})
    assert old_wood["fire_risk"] > new_rcc["fire_risk"]


def test_coastal_city_raises_flood_risk():
    coastal = analyse_risk({"location": "Chennai"})
    inland = analyse_risk({"location": "Bhopal"})
    assert coastal["flood_risk"] > inland["flood_risk"]


def test_seismic_zone_raises_earthquake_risk():
    seismic = analyse_risk({"location": "Guwahati"})
    stable = analyse_risk({"location": "Chennai"})
    assert seismic["earthquake_risk"] > stable["earthquake_risk"]


@pytest.mark.parametrize("security_system", ["24x7 security guard", "cctv camera"])
def test_each_security_measure_lowers_theft_risk_on_its_own(security_system):
    """
    Guards and electronic surveillance are scored on independent branches, so
    each is checked alone — combining them lets one branch mask a regression in
    the other.
    """
    unguarded = analyse_risk({"location": "Chennai", "security_system": "none"})
    secured = analyse_risk({"location": "Chennai", "security_system": security_system})
    assert secured["theft_risk"] < unguarded["theft_risk"]


def test_security_measures_stack():
    both = analyse_risk({"location": "Chennai", "security_system": "24x7 security guard cctv"})
    guard_only = analyse_risk({"location": "Chennai", "security_system": "24x7 security guard"})
    assert both["theft_risk"] < guard_only["theft_risk"]


def test_a_mere_lock_counts_as_no_real_security():
    nothing = analyse_risk({"location": "Chennai", "security_system": "none"})
    lock = analyse_risk({"location": "Chennai", "security_system": "basic lock"})
    assert lock["theft_risk"] == nothing["theft_risk"]


def test_ageing_wiring_raises_electrical_risk():
    old = analyse_risk({"property_age": "35"})
    new = analyse_risk({"property_age": "1"})
    assert old["electrical_damage_risk"] > new["electrical_damage_risk"]


# ── Top-3 recommendation ──────────────────────────────────────────────────────

STANDARD_PROFILE = {
    "budget": "10000",
    "property_type": "apartment",
    "location": "Chennai",
    "property_value": "50 lakh",
    "property_age": "5",
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
    assert result["category"] == "property"
    assert result["recommended"] == result["plans"][0]["plan_name"]
    assert result["property_cat"]


def test_get_top3_only_offers_plans_from_the_customers_segment():
    result = get_top3_recommendations(STANDARD_PROFILE)
    allowed = {PROPERTY_PLANS[k]["plan_name"] for k in PLANS_BY_SEGMENT["standard"]}
    assert {p["plan_name"] for p in result["plans"]} <= allowed


@pytest.mark.parametrize("budget,segment", [
    ("3000",  "Budget"),
    ("10000", "Standard"),
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
