"""
Characterisation tests for InterruptDetector — the mid-workflow domain switch.

This is the layer that decides whether a customer already talking to one agent
has just asked for a different one. It runs ahead of the IDE gate in
CentralOrchestrator.dispatch and is, in practice, the only thing that catches a
switch phrased without an explicit hand-off ("i also need…").

The two sections that carry the weight are "Length must not decide the outcome"
and "Scenery vs shopping" — between them they pin the fix for a defect where
length alone decided routing, dropping polite requests and interrupting
customers who had said their current domain out loud.
"""

import pytest

from app.orchestrator.interrupt_detector import (
    _AGENT_NAMES,
    _MAX_WORDS,
    _PRODUCT_TERMS,
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


def test_a_longer_product_request_is_detected_but_least_confident(detector):
    message = "can you please tell me about car insurance for my brand new vehicle today"
    result = detector.detect(message, "health")
    assert result.detected is True
    assert result.confidence == 0.84


def test_confidence_tiers_are_ordered(detector):
    strongest = detector.detect("forget this, travel", "health").confidence
    abandon = detector.detect("actually I think I need motor insurance", "health").confidence
    short = detector.detect("motor please", "health").confidence
    product = detector.detect(
        "can you please tell me about car insurance for my brand new vehicle today", "health"
    ).confidence
    assert strongest > abandon > short > product


def test_every_detection_explains_itself(detector):
    """The reason string is what shows up in the transfer audit log."""
    result = detector.detect("car insurance", "health")
    assert result.reason
    assert "motor" in result.reason


# ── Length must not decide the outcome ────────────────────────────────────────

def _caught(detector, message, current="health"):
    return detector.detect(message, current).detected


@pytest.mark.parametrize("message", [
    "car insurance",                                            # 2 words
    "i want car insurance please",                              # 5 words
    "i want car insurance for my car",                          # 7 words
    "can you tell me about car insurance please",               # 8 words
    "can you tell me about car insurance for my vehicle",       # 10 words
    "can you tell me about car insurance for my new vehicle",   # 11 words
    "can you please tell me about car insurance for my brand new vehicle today",
                                                                # 14 words
])
def test_one_intent_is_caught_at_every_length(detector, message):
    """
    Regression guard for the politeness gap.

    A 6-12 word band used to be dropped here, deferring to the IDE ("Let IDE
    handle the remainder") — but the IDE's gate declined them too, since they
    carry no hand-off phrase and it trusts the active session. Each layer
    assumed the other had it. Holding this intent fixed and varying only
    length, it was caught at 2, 5, 7 and 14 words and missed at 8 through 11:
    asking politely was what lost the transfer, which landed on exactly the
    first-time and senior customers this product exists for.

    Length is no longer an input to the decision. If a band is ever
    reintroduced, this fails at the lengths inside it.
    """
    assert _caught(detector, message) is True


# ── Scenery vs shopping ───────────────────────────────────────────────────────

@pytest.mark.parametrize("message", [
    "I need health insurance because I had a car accident",
    "I need health insurance because I had a car accident last year and want coverage",
    "does the health policy cover injuries from a car accident that happened last year",
    "my health plan should cover me when I travel abroad for work next year ok",
    "I want health cover for my family and I also drive a car daily to office",
    "will the health policy pay for an ambulance after a car crash",
])
def test_naming_the_current_domain_vetoes_the_switch(detector, message):
    """
    Each of these offered a transfer before the veto existed — interrupting a
    customer who had just said "health insurance" out loud to ask whether they
    would rather discuss motor. The other domain's word is scenery here, not a
    request.
    """
    assert _caught(detector, message) is False


def test_an_abandon_word_overrides_the_veto(detector):
    """
    "actually" names the current domain and still means to leave it — an
    explicit abandon outranks the scenery rule.

    Note the phrasing: bare "forget" is not an abandon word (the list carries
    "forget that/this/it"), so "forget health, lets do travel insurance" reads
    as scenery and stays put. That is a pre-existing lexicon gap, left alone
    here.
    """
    assert _caught(detector, "actually forget health, lets do travel insurance") is True


def test_a_short_switch_is_not_vetoed_by_naming_the_current_domain(detector):
    """
    The veto only applies past five words. "forget health, travel" is too short
    to be anything but the request, and — because bare "forget" is not an
    abandon word — the veto would otherwise swallow it.
    """
    assert _caught(detector, "forget health, travel") is True


@pytest.mark.parametrize("message", [
    "my brother drives a car to work every single day of the week",
    "the traffic and all the cars here in chennai are really terrible these days",
])
def test_a_passing_mention_with_no_product_word_is_not_a_switch(detector, message):
    """
    No product word, so nothing here reads as shopping. These were detected at
    0.74 before, purely for being over 12 words long.
    """
    assert _caught(detector, message) is False


def test_a_short_bare_mention_is_still_a_switch(detector):
    """
    Short messages are exempt from the product-word rule: "motor please" has no
    product word and plainly means it.
    """
    assert _caught(detector, "motor please") is True


@pytest.mark.parametrize("term,message", [
    ("insurance", "can you tell me about car insurance for my new vehicle"),
    ("policy",    "what would a policy for my new car cost me these days"),
    ("cover",     "i want to cover my new car against damage and theft"),
    ("coverage",  "what coverage can i get for my new car please tell me"),
    ("plan",      "is there a plan for my new car that you would suggest"),
    ("premium",   "i just bought a new bike and want to know the premium for it"),
    ("quote",     "can i get a quote for my new bike from you today please"),
])
def test_every_product_word_opens_the_switch(detector, term, message):
    """
    Customers do not all say "insurance". Each term in _PRODUCT_TERMS is
    exercised through a real sentence — testing only the "insurance" phrasing
    leaves the other six free to be deleted without a test noticing.
    """
    assert term in _PRODUCT_TERMS
    assert _caught(detector, message) is True
