"""
A turn the agent could not produce must leave no trace.

This is the second half of the "10k sure" defect. The crash itself made Sarah
answer with the generic interruption message; what made it *keep* answering
that way was retention. The apology was written to the conversation store, so
it reappeared in the customer's window on every reload and was replayed to the
model as prior advisor speech, and it was cached against (session, message),
so retyping the same sentence returned the same apology even after the crash
was fixed.

The environment is driven directly with a stub agent — no orchestrator boots,
no LLM is called, and the fake memory orchestrator records writes instead of
touching disk.
"""

import asyncio

from app.agents.agent_environment import AgentEnvironment
from app.agents.base_agent import AgentResponse


class _RecordingMemory:
    """Stands in for MemoryOrchestrator, remembering what it was asked to save."""

    def __init__(self):
        self.saved_turns = []

    def load_conversation_history(self, *a, **kw):
        return []

    def save_turn(self, customer_id, domain, user_message, assistant_message):
        self.saved_turns.append((user_message, assistant_message))

    def update_profile(self, *a, **kw):
        return {}

    def load_profile(self, *a, **kw):
        return {}


class _StubAgent:
    NAME = "Sarah AI"
    DOMAIN = "health"
    TITLE = "Family Health & Medical Insurance Specialist"

    def __init__(self, response: AgentResponse):
        self._response = response
        self._memory_orch = _RecordingMemory()
        self.calls = 0

    async def respond(self, message, history, user_name, session_id, user_id=None):
        self.calls += 1
        return self._response


def _env(response: AgentResponse):
    agent = _StubAgent(response)
    return AgentEnvironment(agent, {"domain": "health", "name": "Sarah AI"}), agent


FAILED = AgentResponse(
    text="Hello Sivamaran J, I'm Sarah AI. I'm experiencing a brief interruption.",
    agent_name="Sarah AI",
    agent_domain="health",
    failed=True,
)

ANSWERED = AgentResponse(
    text="Based on your profile, here are three plans that fit.",
    agent_name="Sarah AI",
    agent_domain="health",
)


def test_the_customer_still_sees_the_apology():
    env, _ = _env(FAILED)
    result = asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    assert "brief interruption" in result.text
    assert result.env_metadata["failed"] is True


def test_a_failed_turn_is_not_written_to_the_conversation_store():
    env, agent = _env(FAILED)
    asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    assert agent._memory_orch.saved_turns == []


def test_a_failed_turn_is_not_replayed_from_the_response_cache():
    """The same message asked twice must reach the agent twice — otherwise a
    fixed bug still answers with the apology it cached before the fix."""
    env, agent = _env(FAILED)
    asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    assert agent.calls == 2


def test_a_failed_turn_does_not_enter_the_history_sent_to_the_model():
    env, _ = _env(FAILED)
    asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    assert env._history.get("s1", []) == []


def test_a_failed_turn_is_counted_as_an_error():
    env, _ = _env(FAILED)
    asyncio.run(env.process("10k sure", "s1", "Sivamaran J"))
    assert env.diagnostics.total_errors == 1


def test_a_real_answer_is_still_retained_normally():
    """The guard must be narrow: an ordinary reply is cached, saved, and kept."""
    env, agent = _env(ANSWERED)
    asyncio.run(env.process("what do you recommend?", "s1", "Sivamaran J"))
    assert agent._memory_orch.saved_turns == [
        ("what do you recommend?", ANSWERED.text)
    ]
    assert len(env._history["s1"]) == 2
    asyncio.run(env.process("what do you recommend?", "s1", "Sivamaran J"))
    assert agent.calls == 1  # second identical ask served from cache
