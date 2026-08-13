"""
Regression tests for the rule-based executive approval step.

This ran outside the LLM try/except, so anything it raised escaped past every
fallback in `generate_response` and surfaced to the customer as the generic
"I'm experiencing a brief interruption" message. It did: a budget of
`"10k sure"` — the customer's own words, stored verbatim — made `float()`
raise, and every turn after the profile completed came back interrupted.

The method is called unbound against a stub because it touches nothing on the
agent but NAME, and building a real agent would boot memory and write profiles
to disk.
"""

from types import SimpleNamespace

import pytest

from app.agents.base_agent import BaseInsuranceAgent

REC = {"type": "multi_plan", "primary_recommendation": {"premium_monthly": 1500}}


def _validate(profile, rec_result=REC):
    stub = SimpleNamespace(NAME="Sarah AI")
    return BaseInsuranceAgent._executive_validate(stub, rec_result, profile)


@pytest.mark.parametrize("budget", [
    "10k sure",          # the real profile that broke the advisor
    "around 2000",
    "2000/month",
    "1 lakh",
    "no idea yet",
    "",
    None,
    2000,
])
def test_free_text_budget_never_raises(budget):
    """A budget is whatever the customer typed. None of it may escape as an
    exception — the customer gets an interruption message instead of a reply."""
    result = _validate({"budget": budget})
    assert result["status"] in ("Approved", "Approved With Conditions")


def test_budget_magnitude_is_understood_not_truncated():
    """₹10k against a ₹1,500 premium is comfortably affordable. Read as ₹10 it
    would trip the >30%-over-budget condition instead."""
    assert _validate({"budget": "10k sure"})["status"] == "Approved"


def test_premium_well_over_budget_is_still_flagged():
    assert _validate({"budget": "1000"})["status"] == "Approved With Conditions"


def test_unreadable_budget_does_not_flag_affordability():
    """With no figure to compare against, the condition cannot be judged — so
    it is not asserted either way."""
    assert _validate({"budget": "no idea yet"})["status"] == "Approved"


def test_free_text_premium_never_raises():
    rec = {"type": "multi_plan", "primary_recommendation": {"premium_monthly": "₹1,500/month"}}
    assert _validate({"budget": "1000"}, rec)["status"] == "Approved With Conditions"


def test_no_recommendation_is_pending():
    assert _validate({"budget": "10k sure"}, None)["status"] == "Pending"
