"""
The voice layer reaches phrasing, and nothing else.

`BaseInsuranceAgent.generate_response` is where a spoken turn's context meets
the rest of the system, and it is the only place it does. These tests pin both
halves of that: that the block arrives when it should, and that everything the
turn actually decides — the profile, the missing-fields gate, the
recommendation, the plan-withholding guard — is bit-for-bit identical whether
the customer spoke or typed.

The second half matters more than the first. A style that could nudge a premium,
skip a consultation question or unlock a plan the engine had not authorised
would not be an adaptation; it would be a mis-sale with a friendly voice.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents.base_agent import BaseInsuranceAgent
from app.services.voice_context import VoiceTurnContext, set_voice_context


class _CapturingLLM:
    """Records the exact system prompt the turn built."""

    def __init__(self):
        self.system_prompt = None

    async def generate_response(self, system_prompt, user_message, history, tools):
        self.system_prompt = system_prompt
        return "A perfectly ordinary reply."


class _StubMiddleware:
    def __init__(self, state="Data Collection", intent="general"):
        self._state = state
        self._intent = intent
        self.seen = []

    def analyze(self, **kwargs):
        from app.middleware.conversation_middleware import (
            ConversationIntent,
            ConversationState,
            MiddlewareContext,
        )

        self.seen.append(kwargs)
        return MiddlewareContext(
            state=ConversationState(self._state),
            intent=ConversationIntent(self._intent),
            profile_view=None,
            locked=False,
            force_compare=False,
            existing_rec_summary=None,
        )


class _Agent(BaseInsuranceAgent):
    NAME = "Test AI"
    DOMAIN = "health"
    QUESTION_PIPELINE = [("budget", "What budget feels comfortable?")]
    REQUIRED_FIELDS = ["budget"]

    def __init__(self, missing=()):
        self._missing = list(missing)
        self._env_config = {}
        self.llm = _CapturingLLM()
        self._middleware = _StubMiddleware()
        self.recommend_calls = []
        self.withhold_calls = []

    def update_profile(self, customer_id, message, user_name):
        return {"name": user_name, "budget": "1000"}

    def _check_missing_details(self, profile):
        return list(self._missing)

    def _get_cached_recommendation(self, customer_id, profile):
        return None

    def _recommendation_for_turn(self, customer_id, profile, missing, ctx, cached, existing):
        self.recommend_calls.append((customer_id, tuple(missing), ctx.intent.value))
        return (None, None)

    def _build_workflow_context(self, *args, **kwargs):
        return "\n=== WORKFLOW ===\nunchanged\n"

    def _build_knowledge_context(self, message):
        return ""

    def _withhold_unauthorised_plans(self, reply, missing, profile):
        self.withhold_calls.append((reply, tuple(missing)))
        return super()._withhold_unauthorised_plans(reply, missing, profile)

    def recommend(self, profile, domain, exclude_plan_ids=None):
        return None


@pytest.fixture(autouse=True)
def clean_context():
    set_voice_context(None)
    yield
    set_voice_context(None)


def run_turn(agent, message="I need cover"):
    return asyncio.run(
        agent.generate_response(message, [], "Sri", "session-1", user_id="user-1")
    )


class TestTheBlockArrives:
    def test_a_spoken_turn_gets_the_style_block(self):
        set_voice_context(VoiceTurnContext(style="confused"))
        agent = _Agent()
        run_turn(agent)
        assert "HOW TO SAY THIS ONE" in agent.llm.system_prompt
        assert "plainer words" in agent.llm.system_prompt

    def test_a_typed_turn_gets_no_block(self):
        # No voice context installed — the prompt is what it has always been.
        agent = _Agent()
        run_turn(agent)
        assert "HOW TO SAY THIS ONE" not in agent.llm.system_prompt

    def test_the_typed_prompt_is_a_prefix_of_the_spoken_one(self):
        typed_agent = _Agent()
        run_turn(typed_agent)
        typed = typed_agent.llm.system_prompt

        set_voice_context(VoiceTurnContext(style="urgent"))
        spoken_agent = _Agent()
        run_turn(spoken_agent)
        spoken = spoken_agent.llm.system_prompt

        # Appended, never interleaved: everything the typed turn said is still
        # said, in the same order, and the block is purely additive at the end.
        assert spoken.startswith(typed)

    def test_a_normal_spoken_turn_still_gets_the_read_aloud_guidance(self):
        set_voice_context(VoiceTurnContext(style="normal"))
        agent = _Agent()
        run_turn(agent)
        assert "read aloud" in agent.llm.system_prompt

    def test_the_stage_is_recorded_back_onto_the_context(self):
        context = VoiceTurnContext(style="brief")
        set_voice_context(context)
        run_turn(_Agent())
        assert context.conversation_state == "Data Collection"
        assert context.intent == "general"


class TestNothingElseMoves:
    """Everything the turn decides is identical, spoken or typed."""

    def test_the_reply_is_unchanged_by_style(self):
        replies = []
        for style in ("normal", "confused", "frustrated", "urgent", "brief"):
            set_voice_context(VoiceTurnContext(style=style))
            replies.append(run_turn(_Agent()))
        set_voice_context(None)
        replies.append(run_turn(_Agent()))
        # The model is stubbed, so this asserts the pipeline around it: nothing
        # downstream of the LLM call reads the style.
        assert len(set(replies)) == 1

    def test_the_middleware_sees_the_same_turn_either_way(self):
        typed_agent = _Agent()
        run_turn(typed_agent)
        set_voice_context(VoiceTurnContext(style="frustrated"))
        spoken_agent = _Agent()
        run_turn(spoken_agent)

        typed_call = typed_agent._middleware.seen[0]
        spoken_call = spoken_agent._middleware.seen[0]
        # Intent detection, the recommendation lock and the pipeline gate all
        # key off these. A style that could move any of them would be changing
        # the conversation, not its wording.
        assert typed_call["message"] == spoken_call["message"]
        assert typed_call["pipeline_complete"] == spoken_call["pipeline_complete"]
        assert typed_call["profile"] == spoken_call["profile"]

    def test_the_recommendation_step_receives_the_same_inputs(self):
        typed_agent = _Agent()
        run_turn(typed_agent)
        set_voice_context(VoiceTurnContext(style="urgent"))
        spoken_agent = _Agent()
        run_turn(spoken_agent)
        assert typed_agent.recommend_calls == spoken_agent.recommend_calls

    def test_the_consultation_gate_is_untouched_by_urgency(self):
        # "I need this urgently" must not skip a question. The pipeline decides
        # what is still missing, and a way of speaking cannot shorten it.
        set_voice_context(VoiceTurnContext(style="urgent"))
        agent = _Agent(missing=["budget"])
        run_turn(agent, "I need this urgently, right now")
        assert agent.withhold_calls[0][1] == ("budget",)

    def test_plan_withholding_still_runs_on_a_spoken_turn(self):
        set_voice_context(VoiceTurnContext(style="frustrated"))
        agent = _Agent(missing=["budget"])
        run_turn(agent)
        # The guard that stops an invented premium reaching a customer runs on
        # every turn, whatever the voice layer thinks about the wording.
        assert len(agent.withhold_calls) == 1

    def test_a_broken_context_does_not_cost_the_turn(self):
        # Requirement: never block the insurance workflow because adaptation
        # failed. A context that raises on read is answered anyway.
        class _Exploding:
            spoken = True
            style = "confused"

            def record_stage(self, state, intent):
                raise RuntimeError("recording the stage exploded")

        set_voice_context(_Exploding())
        agent = _Agent()
        assert run_turn(agent) == "A perfectly ordinary reply."
        assert "HOW TO SAY THIS ONE" not in agent.llm.system_prompt


class TestLanguage:
    def test_the_detected_language_never_reaches_the_prompt(self):
        # Speaking Tamil is not asking for Tamil. English is the default and it
        # moves only when the customer asks in words — `detect_language_request`
        # reads a spoken transcript exactly as it reads a typed message. This
        # field is metadata to be shown, not obeyed; mirroring whichever
        # language the last message happened to be in was a reported complaint.
        set_voice_context(VoiceTurnContext(style="normal", language="ta-IN"))
        agent = _Agent()
        run_turn(agent)
        assert "ta-IN" not in agent.llm.system_prompt
