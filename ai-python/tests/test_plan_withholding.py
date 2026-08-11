"""
Nothing priced leaves an agent before the engine has chosen it.

The recommendation engine only runs once the consultation is complete. Before
that there is no scored plan, so any product the model names it has composed —
and it does compose them, at premiums nobody set, in a table a customer cannot
distinguish from a real quote. Prompt instructions were tried first and were not
enough: the model complies until the customer presses for plans.

These tests pin the enforcement, and just as importantly pin what it must leave
alone — echoing a customer's own budget, naming the advisor, explaining what a
term means. A guard that eats ordinary conversation would be its own defect.
"""
import pytest

from app.agents.base_agent import BaseInsuranceAgent


class _Agent(BaseInsuranceAgent):
    """Bare subclass: the guard is inherited behaviour, not domain behaviour."""

    NAME = "Test AI"
    DOMAIN = "health"
    QUESTION_PIPELINE = [
        ("coverage_type", "Who would you like to insure?"),
        ("budget", "What monthly premium budget feels comfortable?"),
        ("recommendation_confirmed", "CONFIRMATION_STEP"),
    ]

    def __init__(self):  # no LLM, no memory — only the guard is under test
        pass


@pytest.fixture
def agent():
    return _Agent()


PLAN_PITCH = (
    "Here are three options that fit your family:\n\n"
    "| Plan | Monthly Premium | Sum Insured |\n"
    "| **Aegis Family Care Plan** | ₹650 | ₹50 Lakh |\n"
    "| **Aegis Supreme Health Shield** | ₹850 | ₹1 Crore |\n"
)


class TestPlansAreWithheldUntilAuthorised:
    def test_an_invented_plan_table_never_reaches_the_customer(self, agent):
        out = agent._withhold_unauthorised_plans(
            PLAN_PITCH, missing=["budget question"], profile={"coverage_type": "family"}
        )
        assert "Aegis Family Care Plan" not in out
        assert "₹650" not in out
        # The turn still moves forward — the question that was actually due.
        assert out == "What monthly premium budget feels comfortable?"

    def test_a_recommendation_card_is_stripped_even_mid_consultation(self, agent):
        reply = 'Sure!\n\n[RECOMMENDATION:{"planName":"Aegis Made Up","premium":"₹900/month"}]'
        out = agent._withhold_unauthorised_plans(
            reply, missing=["budget question"], profile={"coverage_type": "family"}
        )
        assert "[RECOMMENDATION:" not in out
        assert "Aegis Made Up" not in out

    def test_the_confirmation_sentinel_is_never_spoken_aloud(self, agent):
        # Everything answered except the customer's go-ahead: the guard must ask
        # for it in words, not emit the pipeline's internal marker.
        profile = {"coverage_type": "family", "budget": 1000}
        out = agent._withhold_unauthorised_plans(
            PLAN_PITCH, missing=["confirmation"], profile=profile
        )
        assert "CONFIRMATION_STEP" not in out
        assert out.endswith("?")


class TestOrdinaryConversationIsLeftAlone:
    def test_a_plan_passes_once_the_consultation_is_complete(self, agent):
        # missing == [] means the engine authorised this. Untouched, card and all.
        out = agent._withhold_unauthorised_plans(PLAN_PITCH, missing=[], profile={})
        assert out == PLAN_PITCH

    def test_echoing_the_customers_own_budget_is_not_a_quote(self, agent):
        reply = "Got it — ₹1,000 a month. Which city are you based in?"
        out = agent._withhold_unauthorised_plans(
            reply, missing=["city question"], profile={}
        )
        assert out == reply

    def test_naming_the_advisor_is_not_a_quote(self, agent):
        reply = "Hi, I'm Sarah from Aegis AI. Who would you like to insure?"
        out = agent._withhold_unauthorised_plans(
            reply, missing=["coverage question"], profile={}
        )
        assert out == reply

    def test_explaining_a_term_with_an_example_figure_survives(self, agent):
        # A price with no product named is an explanation, not a sale.
        reply = "Sum insured is the yearly cap — say ₹5,00,000. How many people are we covering?"
        out = agent._withhold_unauthorised_plans(
            reply, missing=["family question"], profile={}
        )
        assert out == reply
