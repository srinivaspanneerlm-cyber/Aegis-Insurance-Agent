"""
Streaming is permitted only where the guardrails cannot rewrite the reply.

This is the safety rule the whole streaming design rests on, and it is worth
stating plainly because getting it wrong is not a glitch — it is a mis-sale.

`_withhold_unauthorised_plans` exists because a model asked to recommend before
the consultation is finished will produce a confident table of plans that do not
exist, at premiums nobody set. It catches that on the way out and replaces the
reply with the question actually due next. A token stream that ran past it would
have already put the invented premium in front of the customer; retracting it
afterwards is not the same as never having said it.

So `BaseInsuranceAgent.generate_response` arms the sink only when nothing is
missing — the one state where the guard's own first line, `if not missing:
return reply`, makes it provably a no-op. These tests pin that decision at the
point it is made.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents.base_agent import BaseInsuranceAgent
from app.services.token_stream import TokenSink, set_sink


class _Agent(BaseInsuranceAgent):
    """The gate is inherited behaviour, so a bare subclass is the right subject."""

    NAME = "Test AI"
    DOMAIN = "health"
    QUESTION_PIPELINE = [("budget", "What budget feels comfortable?")]
    REQUIRED_FIELDS = ["budget"]

    def __init__(self, missing):
        self._missing = missing
        self._env_config = {}
        self.llm = _RecordingLLM()
        self._middleware = _StubMiddleware()

    # Everything the turn does around the LLM call is exercised elsewhere; here
    # it is stubbed so the arming decision is the only thing under test.
    def update_profile(self, customer_id, message, user_name):
        return {"name": user_name}

    def _check_missing_details(self, profile):
        return list(self._missing)

    def _get_cached_recommendation(self, customer_id, profile):
        return None

    def _recommendation_for_turn(self, *args, **kwargs):
        return (None, None)

    def _build_workflow_context(self, *args, **kwargs):
        return ""

    def _build_knowledge_context(self, message):
        return ""

    def recommend(self, profile, domain, exclude_plan_ids=None):
        return None


class _StubMiddleware:
    """The middleware has its own suite; here it only has to return a context."""

    def analyze(self, **kwargs):
        from app.middleware.conversation_middleware import (
            ConversationIntent,
            ConversationState,
            MiddlewareContext,
        )

        return MiddlewareContext(
            state=ConversationState.GREETING,
            intent=ConversationIntent.GENERAL,
            profile_view=None,
            locked=False,
            force_compare=False,
            existing_rec_summary=None,
        )


class _RecordingLLM:
    """Records whether the sink was armed at the moment it was called."""

    def __init__(self):
        self.armed_when_called = None

    async def generate_response(self, system_prompt, user_message, history, tools):
        from app.services.token_stream import current_sink

        sink = current_sink()
        self.armed_when_called = sink.is_armed if sink else None
        if sink is not None and sink.is_armed:
            sink.emit("A streamed reply.")
        return "A streamed reply."


@pytest.fixture(autouse=True)
def clean_context():
    set_sink(None)
    yield
    set_sink(None)


def run_turn(missing):
    agent = _Agent(missing)
    sink = TokenSink()
    set_sink(sink)
    reply = asyncio.run(
        agent.generate_response("hello", [], "Sri", "session-1", user_id="user-1")
    )
    return agent, sink, reply


class TestTheGate:
    def test_a_complete_consultation_may_stream(self):
        # Nothing missing → `_withhold_unauthorised_plans` returns the reply
        # untouched → what is released and what is finally sent are the same.
        agent, sink, reply = run_turn(missing=[])
        assert agent.llm.armed_when_called is True
        assert sink.released == "A streamed reply."
        assert reply == "A streamed reply."

    def test_an_incomplete_consultation_may_not(self):
        # The turn where the model might invent a priced plan. Nothing is
        # released, so nothing can need retracting.
        agent, sink, reply = run_turn(missing=["budget"])
        assert agent.llm.armed_when_called is False
        assert sink.released == ""
        # And the reply itself is unaffected — the buffered path still answers.
        assert reply == "A streamed reply."

    def test_the_agent_identity_travels_with_the_arming(self):
        # The browser needs an advisor to attribute the first word to, well
        # before dispatch returns the metadata.
        _agent, sink, _reply = run_turn(missing=[])
        assert sink.agent_name == "Test AI"
        assert sink.agent_domain == "health"

    def test_the_sink_is_disarmed_once_the_model_stops_writing(self):
        # Anything after this point is the agent's own words — a fallback, a
        # cleaned reply — not something to stream as though the model wrote it.
        _agent, sink, _reply = run_turn(missing=[])
        assert sink.is_armed is False

    def test_the_header_filter_is_handed_over_rather_than_duplicated(self):
        # The sink and `_clean_response` must strip the same lines, or the
        # customer sees a line appear and then vanish.
        _agent, sink, _reply = run_turn(missing=[])
        assert sink._strip_prefixes == tuple(BaseInsuranceAgent._STRIP_HEADERS)


class TestNoSink:
    def test_a_turn_with_no_sink_behaves_exactly_as_before(self):
        # Every non-streamed caller — the plain `/chat` endpoint, the executive
        # agent's direct LLM call — takes this path.
        agent = _Agent(missing=[])
        reply = asyncio.run(
            agent.generate_response("hello", [], "Sri", "session-1", user_id="user-1")
        )
        assert reply == "A streamed reply."
        assert agent.llm.armed_when_called is None
