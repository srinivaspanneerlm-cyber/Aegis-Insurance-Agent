"""
Every specialist consults before it recommends — not just the health one.

The consultation shape is the product, so it cannot be one agent's behaviour.
These run the same contract against all four specialists: nothing priced during
discovery, the requirements read back, permission asked and given, and then one
plan the engine chose rather than a shortlist handed back for the customer to
pick from.

The per-domain detail of the health flow is pinned in
test_health_advisor_consultation.py. What is pinned here is that motor, travel
and property behave the same way — the defect this guards against is a fix that
lands in one agent and quietly leaves the other three as they were.

Everything runs against a temporary memory directory. An agent handed the real
one writes to the customer profiles under Aegis-AI/layer3.
"""
import asyncio
import tempfile
from pathlib import Path

import pytest

from app.agents.alex_ai import AlexAI
from app.agents.emma_ai import EmmaAI
from app.agents.ethan_ai import EthanAI
from app.agents.sarah_ai import SarahAI
from app.memory.memory_orchestrator import MemoryOrchestrator
from app.utils.customer_identity import derive_customer_id


class _StubLLM:
    def __init__(self):
        self.prompts = []

    async def generate_response(self, system_prompt, user_message, history, tools=None):
        self.prompts.append(system_prompt)
        return "(advisor reply)"


# What each specialist asks for, and how a customer answers it. Keyed by field
# rather than ordered, because the consultation is driven below by whichever
# step is actually outstanding — extraction sometimes fills a later field early
# (a budget answer is recognisable on its own), and a fixed script would drift
# out of step with the agent the moment that happened.
CONSULTATIONS = {
    SarahAI: {
        "coverage_type":     "Myself and my parents",
        "family_size":       "Three of us",
        "age":               "I am 27, my father is 62",
        "primary_concern":   "Unexpected hospital bills",
        "existing_coverage": "Employer basic cover",
        "location":          "Chennai",
        "budget":            "About 2500 a month",
        "medical_history":   "No conditions",
    },
    AlexAI: {
        "vehicle_type":      "A car",
        "vehicle_detail":    "Tata Nexon XZ+ 2022",
        "fuel_type":         "Petrol",
        "registration_year": "2022",
        "usage_type":        "Personal use",
        "location":          "Chennai",
        "budget":            "Around 12000 a year",
        "insurance_type":    "Comprehensive",
        "claim_history":     "No claims",
    },
    EthanAI: {
        "destination":        "Germany, international",
        "travel_dates":       "Two weeks in June",
        "num_travellers":     "Two of us",
        "purpose":            "Leisure",
        "traveller_ages":     "34 and 31",
        "medical_conditions": "None",
        "budget":             "About 3000 each",
        "visa_requirement":   "Schengen needs 30000 euro",
        "trip_cost":          "Around 250000 total",
    },
    EmmaAI: {
        "property_type":     "An apartment",
        "location":          "Chennai",
        "construction_type": "RCC",
        "property_age":      "8 years old",
        "built_up_area":     "1200 sqft",
        "property_value":    "About 60 lakh",
        "contents_value":    "Around 8 lakh",
        "security_system":   "CCTV",
        "ownership_type":    "Owner occupied",
        "previous_claims":   "No claims",
        "budget":            "About 9000 a year",
    },
}

AGENTS = list(CONSULTATIONS)
IDS = [cls.NAME for cls in AGENTS]


def build(cls, tmp_path):
    agent = cls(_StubLLM(), None, None)
    agent._memory_orch = MemoryOrchestrator(tmp_path, None)
    return agent


def consult(agent, answers, session):
    """Answer whatever step is outstanding until discovery is complete.

    Returns the customer id. Raises if the consultation stops making progress,
    which is the failure worth hearing about: an agent that asks for a field
    nothing can fill never reaches a recommendation at all.
    """
    cid = derive_customer_id("Test Customer", None, session)
    gates = set(agent.GATES)

    for _ in range(len(answers) * 3):
        profile = agent.load_profile(cid)
        pending = next(
            (f for f, _ in agent.QUESTION_PIPELINE
             if f not in gates and not profile.get(f)),
            None,
        )
        if pending is None:
            return cid
        answer = answers[pending]
        asyncio.run(agent.generate_response(answer, [], "Test Customer", session))
        agent._memory_orch.save_turn(
            cid, agent.DOMAIN, answer, "Noted. And the next detail?"
        )

    raise AssertionError(
        f"{agent.NAME} never finished discovery — still wanting "
        f"{agent._check_missing_details(agent.load_profile(cid))}"
    )


def say(agent, cid, message, session):
    reply = asyncio.run(
        agent.generate_response(message, [], "Test Customer", session)
    )
    agent._memory_orch.save_turn(cid, agent.DOMAIN, message, reply)
    return reply


@pytest.mark.parametrize("cls", AGENTS, ids=IDS)
class TestEverySpecialist:
    def test_the_pipeline_ends_in_the_two_gates(self, cls):
        """Read-back first, permission second. Neither is a question about the
        customer — they are the two decisions the customer makes."""
        steps = [field for field, _ in cls.QUESTION_PIPELINE]
        assert steps[-2:] == ["profile_confirmed", "recommendation_confirmed"]
        sentinels = [q for _, q in cls.QUESTION_PIPELINE[-2:]]
        assert sentinels == ["SUMMARY_STEP", "CONFIRMATION_STEP"]

    def test_the_opening_line_shows_nothing(self, cls, tmp_path):
        agent = build(cls, tmp_path)
        reply = say(agent, "cust_x", "I need insurance", "s-open")
        assert "[RECOMMENDATION:" not in reply

    def test_nothing_is_shown_until_both_gates_are_passed(self, cls, tmp_path):
        agent = build(cls, tmp_path)
        session = f"s-{cls.DOMAIN}-gates"
        cid = consult(agent, CONSULTATIONS[cls], session)

        # Discovery is done, so what is outstanding is the read-back.
        profile = agent.load_profile(cid)
        assert agent._check_missing_details(profile) == [
            "SUMMARY_STEP", "CONFIRMATION_STEP"
        ]

        # Confirming the summary is not consent to see a plan.
        first = say(agent, cid, "Yes, that's right", session)
        assert "[RECOMMENDATION:" not in first
        profile = agent.load_profile(cid)
        assert profile.get("profile_confirmed") == "yes"
        assert not profile.get("recommendation_confirmed")

        # Only the second yes opens it.
        second = say(agent, cid, "Yes, please show me", session)
        assert second.count("[RECOMMENDATION:") == 1
        assert '"single_plan"' in second

    def test_exactly_one_plan_is_recommended(self, cls, tmp_path):
        agent = build(cls, tmp_path)
        session = f"s-{cls.DOMAIN}-one"
        cid = consult(agent, CONSULTATIONS[cls], session)
        profile = agent.load_profile(cid)

        result = agent.recommend(profile, agent.DOMAIN)
        assert result["type"] == "single_plan"
        assert len(result["plans"]) == 1
        assert result["total_plans"] == 1

    def test_the_recommendation_says_why_it_won(self, cls, tmp_path):
        agent = build(cls, tmp_path)
        session = f"s-{cls.DOMAIN}-why"
        cid = consult(agent, CONSULTATIONS[cls], session)

        result = agent.recommend(agent.load_profile(cid), agent.DOMAIN)
        assert result["reason_codes"], "a recommendation with no stated reason"

    def test_an_alternative_is_a_different_plan(self, cls, tmp_path):
        agent = build(cls, tmp_path)
        session = f"s-{cls.DOMAIN}-alt"
        cid = consult(agent, CONSULTATIONS[cls], session)
        profile = agent.load_profile(cid)

        first = agent.recommend(profile, agent.DOMAIN)
        shown = [p["plan_id"] for p in first["plans"]]
        second = agent.recommend(profile, agent.DOMAIN, exclude_plan_ids=shown)
        assert second["plans"][0]["plan_id"] not in shown

    def test_the_plan_comes_from_the_catalogue(self, cls, tmp_path):
        """The engine chose it, so there is nothing for the model to compose."""
        agent = build(cls, tmp_path)
        session = f"s-{cls.DOMAIN}-cat"
        cid = consult(agent, CONSULTATIONS[cls], session)

        plan = agent.recommend(agent.load_profile(cid), agent.DOMAIN)["plans"][0]
        assert plan["plan_name"] and plan["plan_id"]
        assert plan["premium"], "a plan with no premium is not a quote"

    def test_the_advisor_speaks_english(self, cls, tmp_path):
        """The prompt carries the English policy, whatever the customer typed."""
        agent = build(cls, tmp_path)
        say(agent, "cust_lang", "enakku insurance venum", f"s-{cls.DOMAIN}-lang")
        assert "=== LANGUAGE — ENGLISH ===" in agent.llm.prompts[-1]


def test_every_specialist_shares_one_gate_implementation():
    """The consultation shape lives on the base class.

    Four copies of it is how three agents were left behind the first time: the
    health advisor was fixed, and motor, travel and property kept their own
    older copy that passed both gates on a single "yes".
    """
    from app.agents.base_agent import BaseInsuranceAgent

    for cls in AGENTS:
        assert cls.update_profile is BaseInsuranceAgent.update_profile
        assert cls._ensure_recommendation_embedded is (
            BaseInsuranceAgent._ensure_recommendation_embedded
        ) or cls is SarahAI
