"""
Routing tests for CentralOrchestrator — the layer every message passes through.

These drive the real dispatch pipeline, not a mock of it. That is only safe for
messages that FIR or InterruptDetector intercept: both build their suggestion
from a template and return before any agent is invoked, so the message
round-trips with no LLM call and nothing written.

EVERY TEST HERE MUST ASSERT A TRANSFER
──────────────────────────────────────
A message that does *not* trigger a transfer is passed to the live agent, which
calls the LLM and writes the customer's profile under
Aegis-AI/layer3/customer_profile/. An early draft of this file included two
"the customer stays put" cases; they reached the agent and edited real profile
data on disk. The memory engine is constructed with the repository's own
layer3 directory and there is no seam to redirect it, so the rule is the test
above: assert on transfers only.

"Stays put" is covered where it costs nothing — the InterruptDetector and
IntentDetectionEngine unit suites.

Note also that dispatch defaults to user_name="Sri", so it resolves the profile
for customer "sri" — a real one in this repository. On the transfer paths the
profile is round-tripped unchanged (the suite leaves Aegis-AI byte-for-byte
identical, which is worth re-checking if these ever start failing oddly), but
it is a live directory and the margin is thin. Keep the transfer-only rule.

The same hazard makes this file unsafe to mutation-test the usual way:
disabling a transfer path is exactly what sends the message to the agent, so
the mutant — not the test — edits customer data. Mutating central_orchestrator
cost a real profile edit and a restore. Mutate the detectors instead; their
suites cover the same decisions with nothing live behind them.

Known untested as a result: the "don't offer a transfer to the agent already
answering" guard. Exercising it means a message with no transfer, which means
the agent. It is asserted one layer down, in
test_interrupt_detector.py::test_a_mention_of_the_current_domain_is_not_a_switch.

Construction is real and costs ~3s (LLM service, Layer 3 memory engine, Layer 4
decision engine), so the orchestrator is built once per module. Construction
alone writes nothing.
"""

import asyncio

import pytest

from app.orchestrator.central_orchestrator import CentralOrchestrator


@pytest.fixture(scope="module")
def orchestrator():
    return CentralOrchestrator()


@pytest.fixture
def health_session(orchestrator, request):
    """A session already deep in a health conversation."""
    session_id = f"test-{request.node.name}"
    orchestrator.session_manager.set_active_agent(session_id, "health")
    orchestrator.session_manager.set_workflow_status(session_id, "active")
    yield session_id
    orchestrator.session_manager.clear(session_id)


def dispatch(orchestrator, message, session_id, **kwargs):
    return asyncio.run(
        orchestrator.dispatch(message=message, session_id=session_id, **kwargs)
    )


# ── Registry ──────────────────────────────────────────────────────────────────

def test_all_five_environments_are_registered(orchestrator):
    health = orchestrator.get_environment_health()
    assert health["registry_status"] == "active"
    assert health["total_environments"] == 5
    assert set(health["domains"]) == {
        "health", "motor", "travel", "home-property", "executive",
    }


def test_the_default_agent_is_the_executive(orchestrator):
    assert orchestrator.DEFAULT_AGENT == "executive"


# ── Session bookkeeping ───────────────────────────────────────────────────────

def test_an_unseen_session_reports_itself_as_new(orchestrator):
    info = orchestrator.get_session_info("never-seen-before")
    assert info["active_agent"] is None
    assert info["workflow_status"] == "new"


def test_session_info_reflects_the_active_agent(orchestrator, health_session):
    info = orchestrator.get_session_info(health_session)
    assert info["active_agent"] == "health"
    assert info["workflow_status"] == "active"


# ── Transfer suggestion: the shape the UI depends on ──────────────────────────

def test_an_explicit_command_offers_a_transfer(orchestrator, health_session):
    """FIR path — "connect me to X" is unambiguous, so it answers from a template."""
    result = dispatch(orchestrator, "connect me to alex", health_session)
    assert result["suggest_transfer"] is True
    assert result["transfer_to"] == "motor"
    assert result["transfer_to_name"] == "Alex AI"
    assert result["transfer_from"] == "health"


def test_a_bare_product_mention_offers_a_transfer(orchestrator, health_session):
    """InterruptDetector path."""
    result = dispatch(orchestrator, "car insurance", health_session)
    assert result["suggest_transfer"] is True
    assert result["transfer_to"] == "motor"


def test_a_transfer_suggestion_does_not_switch_the_agent(orchestrator, health_session):
    """
    The crown-jewel invariant: a suggestion is an offer, never a move. Sarah is
    still answering until the customer says yes.
    """
    result = dispatch(orchestrator, "car insurance", health_session)
    assert result["suggest_transfer"] is True
    assert result["transferred"] is False
    assert result["agent_domain"] == "health"
    assert result["agent_name"] == "Sarah AI"
    assert orchestrator.get_session_info(health_session)["active_agent"] == "health"


def test_a_transfer_suggestion_carries_everything_the_dialog_renders(
    orchestrator, health_session
):
    result = dispatch(orchestrator, "car insurance", health_session)
    for key in (
        "reply", "agent_name", "agent_domain", "suggest_transfer",
        "transfer_to", "transfer_to_name", "transfer_from",
        "transfer_from_name", "transfer_reason", "session_id",
    ):
        assert key in result, f"missing {key}"
    assert result["session_id"] == health_session
    assert result["reply"]


@pytest.mark.parametrize("message,target", [
    ("car insurance",    "motor"),
    ("travel insurance", "travel"),
    ("home insurance",   "home-property"),
])
def test_each_domain_can_be_switched_to(orchestrator, health_session, message, target):
    result = dispatch(orchestrator, message, health_session)
    assert result["transfer_to"] == target


# ── Routing on intent rather than length ──────────────────────────────────────

@pytest.mark.parametrize("message", [
    "car insurance",                                            # 2 words
    "i want car insurance please",                              # 5 words
    "can you tell me about car insurance please",               # 8 words
    "can you tell me about car insurance for my new vehicle",   # 11 words
    "can you please tell me about car insurance for my brand new vehicle today",
                                                                # 14 words
])
def test_one_intent_reaches_the_transfer_at_every_length(
    orchestrator, health_session, message
):
    """
    End-to-end guard for the politeness gap, through the real pipeline rather
    than InterruptDetector alone. The 8- and 11-word forms used to fall through
    FIR, InterruptDetector and the IDE gate alike and land on Sarah, who would
    answer a motor question as a health one.
    """
    result = dispatch(orchestrator, message, health_session)
    assert result["suggest_transfer"] is True
    assert result["transfer_to"] == "motor"


# The "scenery vs shopping" veto is asserted in test_interrupt_detector.py.
# It cannot be checked here: a vetoed message is by definition one no transfer
# path claims, so dispatch hands it to the live agent — see the module
# docstring.


# ── Interrupts ────────────────────────────────────────────────────────────────

def test_an_interrupt_is_flagged_as_one(orchestrator, health_session):
    """The UI shows a different dialog for a mid-workflow interrupt."""
    result = dispatch(orchestrator, "car insurance", health_session)
    assert result["is_interrupt"] is True




# ── declined domains ──────────────────────────────────────────────────────────
#
# Proving a declined domain is not re-offered means proving a message does NOT
# transfer, which the rule at the top of this file forbids: a non-transferring
# message reaches the live agent and edits real profile data.
#
# The seam that makes it safe: the intent gate is the very next step after the
# interrupt check, so stubbing it stops dispatch in both directions before any
# agent is reached. Landing there proves the interrupt was skipped; not landing
# there proves it fired.

class _ReachedIntentGate(Exception):
    """Dispatch got past the interrupt check. Stops it before the live agent."""


@pytest.fixture
def stop_at_intent_gate(orchestrator, monkeypatch):
    def _stop(*_args, **_kwargs):
        raise _ReachedIntentGate
    monkeypatch.setattr(orchestrator.intent_engine, "needs_detection", _stop)


def test_an_interrupt_fires_when_nothing_is_declined(orchestrator, health_session, stop_at_intent_gate):
    """The default: a mid-workflow domain switch is offered to the user."""
    result = dispatch(orchestrator, "car insurance", health_session, declined_domains=[])
    assert result["is_interrupt"] is True


def test_a_declined_domain_is_not_offered_again(orchestrator, health_session, stop_at_intent_gate):
    """
    The user already said no to motor. Asking about a car again must reach the
    agent, not re-offer the switch — the UI suppresses that dialog, so the
    suggestion would render as an unanswerable question.
    """
    with pytest.raises(_ReachedIntentGate):
        dispatch(orchestrator, "car insurance", health_session, declined_domains=["motor"])


def test_declining_one_domain_does_not_block_another(orchestrator, health_session, stop_at_intent_gate):
    """Refusing motor must not cost the user a genuine switch to travel."""
    result = dispatch(orchestrator, "travel insurance", health_session, declined_domains=["motor"])
    assert result["is_interrupt"] is True
    assert result["transfer_to"] == "travel"


def test_declining_survives_the_whole_session(orchestrator, health_session, stop_at_intent_gate):
    """
    Not a per-message flag: the same declined domain stays declined across
    every later message, which is the rule the UI already enforces.
    """
    for _ in range(3):
        with pytest.raises(_ReachedIntentGate):
            dispatch(orchestrator, "car insurance", health_session, declined_domains=["motor"])
