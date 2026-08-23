"""
Ambiguous, two-domain messages — precedence in FastIntentRouter and
InterruptDetector.

"Repeated speech" and "ambiguous speech" from the voice test matrix. Deliberately
driven at the detector level, not through CentralOrchestrator.dispatch: a
message naming two domains but with no *explicit* transfer trigger still falls
through to the live agent there (see test_central_orchestrator.py's own
"every test must assert a transfer" rule — the orchestrator has no test seam
that avoids writing real customer profile data to disk). Both detectors below
are pure functions with no LLM and no disk, so the precedence they resolve to
is exactly what a real ambiguous turn would get, without that hazard.

Precedence is dict-iteration order over `_AGENT_KEYWORDS`
(motor, health, travel, home-property, executive) — first match wins,
regardless of which keyword appears first in the sentence. Verified against
the actual running code before being pinned here, not guessed.
"""
from app.orchestrator.fast_intent_router import FastIntentRouter
from app.orchestrator.interrupt_detector import InterruptDetector


# ── FastIntentRouter: explicit two-domain commands ─────────────────────────────

def test_fir_resolves_two_domains_to_the_earlier_one_in_keyword_order():
    fir = FastIntentRouter()
    result = fir.detect("connect me to car and travel insurance")
    assert result.detected is True
    assert result.target_domain == "motor"


def test_fir_precedence_is_by_domain_order_not_word_order_in_the_sentence():
    """"sarah" (health) appears before "alex" (motor) in the sentence, but
    motor is checked first in _AGENT_KEYWORDS — precedence follows domain
    order, not string position, and that must not silently change."""
    fir = FastIntentRouter()
    result = fir.detect("switch to sarah or alex")
    assert result.detected is True
    assert result.target_domain == "motor"


def test_fir_resolves_travel_and_property_to_travel():
    fir = FastIntentRouter()
    result = fir.detect("take me to emma and ethan")
    assert result.detected is True
    assert result.target_domain == "travel"


# ── InterruptDetector: implicit two-domain mid-workflow mentions ──────────────

def test_interrupt_detector_resolves_two_domains_the_same_way():
    detector = InterruptDetector()
    result = detector.detect("actually I also need car and travel insurance", "health")
    assert result.detected is True
    assert result.target_domain == "motor"


def test_interrupt_detector_precedence_matches_fir_for_the_same_domain_pair():
    """Both detectors read _AGENT_KEYWORDS-shaped domain lists; a message
    naming home-property and motor should resolve the same way in both, so a
    customer doesn't get routed differently depending on which detector
    happens to catch their turn."""
    detector = InterruptDetector()
    result = detector.detect("what about home and motor insurance", "travel")
    assert result.detected is True
    assert result.target_domain == "motor"


# ── Repeated identical explicit commands are idempotent ────────────────────────

def test_repeating_the_same_transfer_command_resolves_identically():
    """"Repeated speech" from the test matrix, at the one layer safe to drive
    directly: firing the same explicit command three times in a row (a
    customer repeating themselves because they weren't sure it registered)
    must resolve to the same target every time, not flip-flop or degrade."""
    fir = FastIntentRouter()
    results = [fir.detect("connect me to alex") for _ in range(3)]
    assert all(r.detected and r.target_domain == "motor" for r in results)
    assert len({r.confidence for r in results}) == 1
