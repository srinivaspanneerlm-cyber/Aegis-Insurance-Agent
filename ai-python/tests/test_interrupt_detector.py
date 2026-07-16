"""
Characterisation tests for InterruptDetector — the mid-workflow domain switch.

This is the layer that decides whether a customer already talking to one agent
has just asked for a different one. It runs ahead of the IDE gate in
CentralOrchestrator.dispatch and is, in practice, the only thing that catches a
switch phrased without an explicit hand-off ("i also need…").

test_the_politeness_gap below documents a live defect rather than asserting it
is correct — read it before changing anything here.
"""

import pytest

from app.orchestrator.interrupt_detector import (
    _AGENT_NAMES,
    _MAX_WORDS,
    InterruptDetector,
)


@pytest.fixture
def detector():
    return InterruptDetector()


# ── Guards ────────────────────────────────────────────────────────────────────

def test_no_active_domain_means_nothing_to_interrupt(detector):
    assert detector.detect("car insurance", None).detected is False


def test_a_mention_of_the_current_domain_is_not_a_switch(detector):
    assert detector.detect("health insurance", "health").detected is False


def _message_of(word_count):
    """A message carrying a motor keyword, padded to exactly `word_count` words."""
    message = "car insurance " + " ".join(["padding"] * (word_count - 2))
    assert len(message.split()) == word_count
    return message


def test_the_word_cap_sits_at_twenty_five(detector):
    """
    Past the cap a domain keyword reads as incidental rather than a request.

    The boundary is spelled out in literals rather than derived from
    _MAX_WORDS: a test that builds its input from the constant it is checking
    moves with it, and stays green even if the cap is raised to 100.
    """
    assert _MAX_WORDS == 25
    assert detector.detect(_message_of(25), "health").detected is True
    assert detector.detect(_message_of(26), "health").detected is False


def test_a_message_with_no_domain_keyword_is_not_a_switch(detector):
    assert detector.detect("yes please go on", "health").detected is False


# ── Detection and routing ─────────────────────────────────────────────────────

@pytest.mark.parametrize("message,target", [
    ("car insurance",   "motor"),
    ("travel insurance", "travel"),
    ("home insurance",  "home-property"),
])
def test_a_short_domain_mention_is_a_switch(detector, message, target):
    result = detector.detect(message, "health")
    assert result.detected is True
    assert result.target_domain == target


def test_the_result_names_the_agent_the_ui_will_offer(detector):
    result = detector.detect("car insurance", "health")
    assert result.target_name == _AGENT_NAMES["motor"] == "Alex AI"
    assert result.current_domain == "health"


@pytest.mark.parametrize("domain,name", list(_AGENT_NAMES.items()))
def test_every_domain_maps_to_an_agent_name(domain, name):
    assert name


# ── Confidence tiers ──────────────────────────────────────────────────────────

def test_abandon_plus_short_domain_is_the_strongest_signal(detector):
    result = detector.detect("forget this, travel", "health")
    assert result.confidence == 0.96
    assert result.target_domain == "travel"


def test_abandon_plus_a_longer_sentence_stays_confident(detector):
    result = detector.detect("actually I think I need motor insurance", "health")
    assert result.confidence == 0.91


def test_a_bare_short_mention_is_confident_without_an_abandon_word(detector):
    result = detector.detect("motor please", "health")
    assert result.confidence == 0.88


def test_a_long_mention_is_detected_but_least_confident(detector):
    message = "can you please tell me about car insurance for my brand new vehicle today"
    result = detector.detect(message, "health")
    assert result.detected is True
    assert result.confidence == 0.74


def test_confidence_tiers_are_ordered(detector):
    strongest = detector.detect("forget this, travel", "health").confidence
    abandon = detector.detect("actually I think I need motor insurance", "health").confidence
    short = detector.detect("motor please", "health").confidence
    long = detector.detect(
        "can you please tell me about car insurance for my brand new vehicle today", "health"
    ).confidence
    assert strongest > abandon > short > long


def test_every_detection_explains_itself(detector):
    """The reason string is what shows up in the transfer audit log."""
    result = detector.detect("car insurance", "health")
    assert result.reason
    assert "motor" in result.reason


# ── The politeness gap (live defect) ──────────────────────────────────────────

def _caught(detector, message, current="health"):
    return detector.detect(message, current).detected


def test_short_and_long_phrasings_of_one_intent_are_both_caught(detector):
    assert _caught(detector, "car insurance") is True
    assert _caught(detector, "can you please tell me about car insurance "
                             "for my brand new vehicle today") is True


@pytest.mark.parametrize("message", [
    "can you tell me about car insurance please",                # 8 words
    "can you tell me about car insurance for my vehicle",        # 10 words
    "can you tell me about car insurance for my new vehicle",    # 11 words
])
def test_the_politeness_gap(detector, message):
    """
    LIVE DEFECT — asserts what happens today, not what should happen.

    interrupt_detector.py:177 drops 6–12 word messages that carry a domain
    keyword but no abandon word, deferring to the IDE ("Let IDE handle the
    remainder"). The IDE's gate then declines them too, because they contain no
    hand-off phrase and it trusts the active session. Each layer assumes the
    other has it.

    The result is a hole shaped like nothing anyone designed. Holding the
    intent fixed and varying only length, "tell me about car insurance" is
    caught at 2, 5, 7, 14 and 17 words — and missed at 8 through 11. Phrasing
    the same question politely is what loses the transfer, which lands hardest
    on the first-time and senior customers this product exists for.

    Fixing it means closing the 6–12 band here, in the layer that already owns
    mid-session switches. When that happens, this test inverts to True and
    joins the cases above.
    """
    assert _caught(detector, message) is False


def test_the_gap_has_hard_edges_at_five_and_twelve_words(detector):
    """Pins the exact band, so a fix can be checked against it."""
    assert _caught(detector, "i want car insurance please") is True            # 5w
    assert _caught(detector, "can you tell me about car insurance please") is False   # 8w
    assert _caught(detector, "can you please tell me about car insurance "
                             "for my brand new vehicle today") is True         # 14w


def test_an_abandon_word_rescues_a_message_inside_the_gap(detector):
    """
    The same 8-word question is caught the moment it carries "actually" —
    further evidence the band is an oversight rather than a deliberate
    ambiguity threshold.
    """
    assert _caught(detector, "can you tell me about car insurance please") is False
    assert _caught(detector, "actually can you tell me about car insurance") is True
