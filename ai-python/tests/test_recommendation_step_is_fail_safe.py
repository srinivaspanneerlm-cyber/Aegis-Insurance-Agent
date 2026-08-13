"""
A recommendation the engine cannot build must not cost the customer their turn.

Everything arithmetic about a turn — scoring, premium comparison, underwriting
approval — runs on values the customer typed in their own words. When any of
it raised, the exception escaped the whole turn and the reply became the
generic interruption message, even though the advisor had plenty to say
without a plan card. This pins the degraded path: the card is dropped, the
conversation continues.

The agent is driven with a stub LLM and no memory, so nothing is written to
disk and no real engine runs.
"""

import asyncio

from app.agents.base_agent import BaseInsuranceAgent

REPLY = "Tell me a little more about who we are covering."


class _StubLLM:
    async def generate_response(self, system_prompt, user_message, history, tools):
        return REPLY


class _Agent(BaseInsuranceAgent):
    NAME = "Sarah AI"
    DOMAIN = "health"
    TITLE = "Family Health & Medical Insurance Specialist"
    SYSTEM_PROMPT = "You are a health insurance advisor."
    QUESTION_PIPELINE = []
    REQUIRED_FIELDS = []

    def __init__(self, blow_up_in):
        super().__init__(_StubLLM(), None, None)
        self._memory_orch = None          # never touch the real profile store
        self._blow_up_in = blow_up_in

    def update_profile(self, customer_id, message, user_name=None):
        return {"customer_id": customer_id, "budget": "10k sure"}

    def recommend(self, profile, category):
        if self._blow_up_in == "recommend":
            raise ValueError("scoring engine exploded")
        return {"type": "multi_plan", "primary_recommendation": {"premium_monthly": 1500}}

    def _executive_validate(self, rec_result, profile):
        if self._blow_up_in == "validate":
            raise ValueError("could not convert string to float: '10k sure'")
        return super()._executive_validate(rec_result, profile)


def _answer(blow_up_in):
    agent = _Agent(blow_up_in)
    return asyncio.run(
        agent.generate_response("what do you suggest?", [], "Sivamaran J", "s1")
    )


def test_a_scoring_failure_still_gets_the_customer_an_answer():
    assert _answer("recommend") == REPLY


def test_an_approval_failure_still_gets_the_customer_an_answer():
    """This is the exact crash that broke the advisor — as an escaped
    exception it produced no answer at all."""
    assert _answer("validate") == REPLY


def test_no_plan_card_is_attached_when_the_engine_failed():
    """Degrading means no recommendation this turn — not a half-built one."""
    assert "[RECOMMENDATION:" not in _answer("recommend")


def test_the_happy_path_is_unchanged():
    assert _answer(None) == REPLY
