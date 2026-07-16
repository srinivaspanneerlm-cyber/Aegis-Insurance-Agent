"""
Characterisation tests for the Intent Detection Engine (IDE).

READ THIS BEFORE "FIXING" THE GATE
──────────────────────────────────
Once a session is active the IDE routes on **phrasing, not on domain score**.
That looks like a bug and is not.

  • "i also need car insurance"  → gate opens → request_transfer to motor
  • "car insurance"              → gate stays shut, even though motor scores a
                                   maximal 1.0

The difference is _DOMAIN_CHANGE_RE, not the lexicon. An explicit hand-off
phrase ("i also need…", "let's talk about…", "i want to switch to…") is treated
as the customer asking to move; a bare product mention is treated as talk
*within* the current conversation, because it usually is — "I need health
insurance because I had a car accident" scores motor 0.62 and means health.

Score-driven routing for active sessions is deliberately somebody else's job:
FastIntentRouter and InterruptDetector run *before* this gate in
CentralOrchestrator.dispatch (see interrupt_detector.py:9). Making the gate
score-driven would duplicate them and mis-fire on the accident example above.

Known gap, live at the time of writing: a message with a strong other-domain
signal, no hand-off phrase, and no InterruptDetector keyword falls through all
three layers — e.g. "can you tell me about car insurance for my new vehicle"
(motor 1.0) leaves Sarah answering a motor question. The fix belongs in
InterruptDetector, whose job this already is, not in this gate.
"""

import pytest

from app.intent.intent_engine import IntentDetectionEngine, IntentResult


@pytest.fixture
def engine():
    return IntentDetectionEngine()


# ── Cold start: the IDE's actual job ──────────────────────────────────────────

@pytest.mark.parametrize("message,expected_domain", [
    ("health insurance for my family",   "health"),
    ("car insurance for my new vehicle", "motor"),
    ("trip to europe next month",        "travel"),
    ("home insurance for my flat",       "home-property"),
])
def test_cold_start_routes_to_the_right_domain(engine, message, expected_domain):
    result = engine.analyze(message=message, active_agent=None)
    assert result.domain == expected_domain
    assert result.workflow_action == "new_workflow"


def test_cold_start_falls_back_to_executive_for_unrecognisable_input(engine):
    result = engine.analyze(message="xyzzy nonsense words", active_agent=None)
    assert result.domain == engine.DEFAULT_AGENT == "executive"


@pytest.mark.parametrize("message,expected_domain", [
    ("sarah ai", "health"),
    ("alex ai",  "motor"),
])
def test_naming_an_agent_routes_to_that_agent(engine, message, expected_domain):
    result = engine.analyze(message=message, active_agent=None)
    assert result.domain == expected_domain


# ── Active session: the IDE deliberately stands down ──────────────────────────

ACTIVE_SESSION_MESSAGES = [
    "car insurance for my new vehicle",   # strongest signal is motor
    "trip to europe next month",          # strongest signal is travel
    "health insurance for my family",     # agrees with the active agent
    "xyzzy nonsense words here",          # no signal at all
]


@pytest.mark.parametrize("message", ACTIVE_SESSION_MESSAGES)
def test_analyze_continues_when_no_hand_off_phrase_is_present(engine, message):
    """
    Not a bug — see module docstring. Without an explicit hand-off phrase the
    IDE hands the message back to the active agent regardless of domain score,
    because a bare product mention usually belongs to the current conversation.
    """
    result = engine.analyze(message=message, active_agent="health", workflow_status="active")
    assert result.workflow_action == "continue"
    assert result.next_agent == "health"
    assert result.is_continuation is True


def test_analyze_continues_with_whichever_agent_is_active(engine):
    """The continue decision follows active_agent, not the message."""
    for agent in ("health", "motor"):
        result = engine.analyze(message="car insurance for my new vehicle", active_agent=agent)
        assert result.next_agent == agent


# ── The hand-off escape hatch — the one live route out of a session ───────────

HAND_OFF_MESSAGES = [
    ("i also need car insurance",                    "motor"),
    ("lets talk about travel insurance",             "travel"),
    ("I want to switch to motor insurance please now", "motor"),
]


@pytest.mark.parametrize("message,target", HAND_OFF_MESSAGES)
def test_a_hand_off_phrase_opens_the_gate(engine, message, target):
    assert engine._DOMAIN_CHANGE_RE.search(message)
    assert engine.needs_detection("health", message, None, "active") is True


@pytest.mark.parametrize("message,target", HAND_OFF_MESSAGES)
def test_a_hand_off_phrase_produces_a_transfer_request(engine, message, target):
    """
    Gate and analyze have to agree: the gate opening is only useful because
    analyze then asks for the transfer rather than continuing.
    """
    result = engine.analyze(message=message, active_agent="health", workflow_status="active")
    assert result.workflow_action == "request_transfer"
    assert result.next_agent == target
    assert result.secondary_domain == target


def test_a_hand_off_phrase_without_a_second_domain_stays_put(engine):
    """The phrase alone is not enough — the gate needs somewhere to send them."""
    assert engine.needs_detection("health", "lets talk about this", None, "active") is False


def _max_other_domain_score(engine, message, active_agent):
    others = {
        domain: score
        for domain, score in engine._score_domains(message.lower()).items()
        if domain != active_agent
    }
    return max(others.values()) if others else 0.0


def test_a_hand_off_to_a_confidently_named_domain_opens_the_gate(engine):
    message = "i also need car insurance"
    assert _max_other_domain_score(engine, message, "health") >= engine.TRANSFER_GATE
    assert engine.needs_detection("health", message, None, "active") is True


def test_a_hand_off_just_over_the_bar_still_opens_the_gate(engine):
    """
    Brackets TRANSFER_GATE from just above. "health" alone hints 0.72 against a
    0.68 bar — the narrowest passing margin the lexicon offers — so raising the
    threshold at all is caught here rather than shipping.
    """
    message = "lets talk about health"
    score = _max_other_domain_score(engine, message, "motor")
    assert engine.TRANSFER_GATE < score < 0.80
    assert engine.needs_detection("motor", message, None, "active") is True


def test_a_hand_off_to_a_weakly_hinted_domain_does_not_open_the_gate(engine):
    """
    The other half of TRANSFER_GATE. "hospital" hints health at 0.62 — under
    the 0.68 bar — so a motor session stays put rather than dragging the
    customer through a transfer prompt on a passing mention.

    Pairing this with the test above pins the threshold from both sides:
    without it, lowering TRANSFER_GATE to 0.10 keeps every other test green.
    """
    message = "lets talk about the hospital"
    assert engine._DOMAIN_CHANGE_RE.search(message)
    assert _max_other_domain_score(engine, message, "motor") < engine.TRANSFER_GATE
    assert engine.needs_detection("motor", message, None, "active") is False


# ── The detection gate ────────────────────────────────────────────────────────

def test_gate_runs_detection_when_there_is_no_active_session(engine):
    assert engine.needs_detection(None, "hi", None, "active") is True


@pytest.mark.parametrize("workflow_status", ["completed", "cancelled"])
def test_gate_runs_detection_once_the_workflow_has_ended(engine, workflow_status):
    assert engine.needs_detection("health", "anything", None, workflow_status) is True


def test_gate_runs_detection_when_the_bot_page_changed(engine):
    """Opening a different advisor page is an explicit routing instruction."""
    assert engine.needs_detection("health", "hello", "motor", "active") is True


def test_gate_skips_detection_when_the_page_matches_the_active_agent(engine):
    assert engine.needs_detection("health", "hello", "health", "active") is False


@pytest.mark.parametrize("message", ["yes", "no", "ok", "tell me more", "35"])
def test_gate_skips_detection_for_pure_continuations(engine, message):
    assert engine.needs_detection("health", message, None, "active") is False


@pytest.mark.parametrize("message", ACTIVE_SESSION_MESSAGES)
def test_gate_stands_down_for_active_sessions_whatever_the_message(engine, message):
    """
    The gate trusts the active session. Pinned because it is the exact place a
    reader is tempted to "fix" — including a message whose motor score is a
    maximal 1.0.
    """
    assert engine.needs_detection("health", message, None, "active") is False


def test_a_maximal_other_domain_score_still_does_not_open_the_gate(engine):
    """
    "car insurance" scores motor 1.0 — the highest the lexicon can produce, far
    above TRANSFER_GATE — and the gate still declines. Routing that message is
    InterruptDetector's job, not the IDE's.
    """
    assert engine._score_domains("car insurance")["motor"] == 1.0
    assert engine._score_domains("car insurance")["motor"] > engine.TRANSFER_GATE
    assert engine.needs_detection("health", "car insurance", None, "active") is False


# ── Continuation detection ────────────────────────────────────────────────────

@pytest.mark.parametrize("message", ["yes", "no", "ok", "tell me more", "35", "what about opd"])
def test_short_replies_read_as_continuations(engine, message):
    assert engine._is_pure_continuation(message, "health") is True


def test_a_named_product_is_not_a_continuation(engine):
    assert engine._is_pure_continuation("car insurance", "health") is False


# ── Domain scoring ────────────────────────────────────────────────────────────

def test_score_domains_is_empty_for_signal_free_text(engine):
    assert engine._score_domains("xyzzy nonsense words") == {}


def test_explicit_product_names_outscore_generic_terms_in_the_lexicon(engine):
    """
    Asserted against the lexicon itself, not against _score_domains output.
    Scoring "health insurance" also matches the generic "health" entry, so a
    scored comparison stays green even if the explicit weight is gutted — the
    generic entry alone still clears "hospital".
    """
    health = engine.DOMAIN_LEXICON["health"]
    assert health["health insurance"] > health["health"] > health["hospital"]


@pytest.mark.parametrize("domain,phrase,weight", [
    ("health", "health insurance", 0.95),
    ("health", "sarah ai",         1.00),
    ("motor",  "alex ai",          1.00),
])
def test_load_bearing_lexicon_weights(engine, domain, phrase, weight):
    """Agent names are the maximum-confidence signal; product names just below."""
    assert engine.DOMAIN_LEXICON[domain][phrase] == weight


def test_scores_never_exceed_one(engine):
    busy = "health insurance car insurance travel insurance home insurance sarah ai alex ai"
    for domain, score in engine._score_domains(busy).items():
        assert 0.0 < score <= 1.0, f"{domain} = {score}"


def test_a_message_can_carry_signals_for_more_than_one_domain(engine):
    scores = engine._score_domains("i need health insurance after a car accident")
    assert "health" in scores
    assert "motor" in scores
    assert scores["health"] > scores["motor"]


# ── Intent labels ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("domain,label", [
    ("health",        "Health Insurance"),
    ("motor",         "Motor Insurance"),
    ("travel",        "Travel Insurance"),
    ("home-property", "Home & Property Insurance"),
    ("executive",     "Corporate & Executive Insurance"),
])
def test_domain_to_intent_labels(engine, domain, label):
    assert engine._domain_to_intent(domain) == label


def test_unknown_domain_falls_back_to_the_executive_label(engine):
    assert engine._domain_to_intent(None) == "Corporate & Executive Insurance"


# ── Result contract ───────────────────────────────────────────────────────────

def test_analyze_returns_an_intent_result(engine):
    assert isinstance(engine.analyze(message="health insurance"), IntentResult)


def test_result_dict_carries_everything_the_orchestrator_reads(engine):
    payload = engine.analyze(message="health insurance", active_agent=None).to_dict()
    for key in (
        "primary_intent", "secondary_intent", "domain", "secondary_domain",
        "confidence", "confidence_pct", "reason", "is_continuation",
        "workflow_action", "next_agent", "current_workflow", "signals",
    ):
        assert key in payload, f"missing {key}"


def test_confidence_is_a_probability(engine):
    for message in ACTIVE_SESSION_MESSAGES:
        result = engine.analyze(message=message, active_agent=None)
        assert 0.0 <= result.confidence <= 1.0


def test_confidence_pct_agrees_with_confidence(engine):
    payload = engine.analyze(message="health insurance", active_agent=None).to_dict()
    assert payload["confidence_pct"] == f"{round(payload['confidence'] * 100)}%"


def test_analyze_records_an_audit_trail_of_signals(engine):
    """Every routing decision has to be explainable after the fact."""
    result = engine.analyze(message="health insurance for my family", active_agent=None)
    assert result.signals
    for signal in result.signals:
        assert signal.source
        assert 0.0 <= signal.confidence <= 1.0
        assert signal.reason


def test_analyze_survives_an_empty_message(engine):
    result = engine.analyze(message="", active_agent=None)
    assert result.domain == engine.DEFAULT_AGENT
