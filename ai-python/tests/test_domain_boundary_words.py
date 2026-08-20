"""
The domain boundary reads whole words, not fragments of them.

The defect these pin: `check_domain_violation` matched its keywords as plain
substrings, and it runs at the very top of `respond()` — before a single line
of consultation logic. So every accidental hit ended the turn and offered the
customer a transfer instead of an answer.

Sarah's motor list was the worst of it. "car" fired from inside "care",
"healthcare", "caregiver", "cardiac" and "career"; "ev", meant for electric
vehicles, fired from inside "even", "every", "never", "seven", "level",
"severe", "prevent" and "eleventh". A customer describing their parents' health
was told that was Motor Insurance and asked whether to connect to Alex.

Three keywords were also wrong as whole words, because they are health
vocabulary in their own right: "auto" (auto-immune), "motor" (motor neurone
disease) and "third party" (the third party administrator who settles a
cashless hospital claim). Those are qualified in the list now.

A second defect sat behind that one, and is pinned here too: finding another
domain's word was treated as being asked for that product. "I had a car
accident and was hospitalised for a week" is a medical history, not a request
for motor insurance, but it ended the consultation all the same. The boundary
now applies InterruptDetector's rules — an own-domain mention keeps the
customer here, and anything longer than a few words has to read as shopping
before a transfer is offered.

Nothing here touches the LLM, the memory engine or the disk — the boundary
check reads the message and the class's own keyword list and nothing else, so
the agents are built with `object.__new__` rather than a real constructor.
"""

import pytest

from app.agents import base_agent
from app.agents.alex_ai import AlexAI
from app.agents.emma_ai import EmmaAI
from app.agents.ethan_ai import EthanAI
from app.agents.sarah_ai import SarahAI


def _agent(cls):
    """An agent with only its class attributes — no LLM, memory or decision engine."""
    return object.__new__(cls)


def _keyword_fires(cls, message: str, domain: str) -> bool:
    """
    Whether `domain`'s keywords match at all, with the request gate bypassed.

    The tests below need to separate two mechanisms that both end in "no
    transfer". Asking `check_domain_violation` alone cannot tell "car" failing
    to match inside "career" apart from the gate deciding the sentence is not a
    request — so the word-boundary tests go through here and read the matcher
    on its own.
    """
    return any(p.search(message) for p in cls._forbidden_patterns()[domain])


# The message the customer actually sent when this was reported. It is a health
# answer end to end; the only motor-shaped thing in it is the word "career".
REPORTED = (
    "My main priority is good coverage for my parents, but I also need to keep "
    "the overall cost affordable because I'm still early in my career."
)


class TestSarahStaysOnHealth:
    def test_the_reported_message_does_not_hand_the_customer_to_motor(self):
        assert not _keyword_fires(SarahAI, REPORTED, "motor")
        assert _agent(SarahAI).check_domain_violation(REPORTED) is None

    @pytest.mark.parametrize(
        "message",
        [
            "I want the best care for my parents.",
            "My mother needs regular healthcare and check-ups.",
            "I am a caregiver for my father.",
            "I had a cardiac issue two years ago.",
            "I'm still early in my career.",
        ],
    )
    def test_car_does_not_fire_from_inside_a_longer_word(self, message):
        assert not _keyword_fires(SarahAI, message, "motor")
        assert _agent(SarahAI).check_domain_violation(message) is None

    @pytest.mark.parametrize(
        "message",
        [
            "Even a small premium increase every year is a problem for me.",
            "I have never had a policy before.",
            "Whatever you recommend, I'll consider it.",
            "My budget is around seven thousand every month.",
            "I work at a level where my income is fixed.",
            "Please prevent any waiting period issues.",
            "The hospital bills were severe last time.",
            "My daughter is in eleventh standard.",
        ],
    )
    def test_ev_does_not_fire_from_inside_a_longer_word(self, message):
        assert not _keyword_fires(SarahAI, message, "motor")
        assert _agent(SarahAI).check_domain_violation(message) is None

    @pytest.mark.parametrize(
        "message",
        [
            # Each of these is a health term that used to read as motor.
            "Who is the third party administrator for cashless claims?",
            "My son has an auto-immune condition.",
            "She was diagnosed with motor neurone disease.",
            "My father has poor motor function after the stroke.",
        ],
    )
    def test_health_vocabulary_is_not_mistaken_for_motor(self, message):
        assert not _keyword_fires(SarahAI, message, "motor")
        assert _agent(SarahAI).check_domain_violation(message) is None


class TestGenuineTransfersStillHappen:
    """The boundary has to keep working, or this fix has broken the product."""

    @pytest.mark.parametrize(
        "message",
        [
            "I need car insurance for my new Swift.",
            "What about my bike — can you cover that too?",
            "I want third party insurance for my bike.",
            "Can you quote zero depreciation on my vehicle?",
            "My EV needs cover.",
        ],
    )
    def test_a_real_motor_question_still_reaches_alex(self, message):
        result = _agent(SarahAI).check_domain_violation(message)
        assert result is not None, f"motor question went unnoticed: {message!r}"
        assert result["target_name"] == "Alex AI"

    def test_a_real_travel_question_still_reaches_ethan(self):
        result = _agent(SarahAI).check_domain_violation(
            "I need travel insurance for a trip abroad."
        )
        assert result is not None and result["target_name"] == "Ethan AI"

    def test_a_real_health_question_still_reaches_sarah_from_motor(self):
        result = _agent(AlexAI).check_domain_violation(
            "I also need a hospitalization policy for my family."
        )
        assert result is not None and result["target"] == "health"


class TestPassingMentionIsNotARequest:
    """
    Finding another domain's word is not the same as being asked for it.

    Every message here names a real car, hospital or country, as a whole word,
    while answering the question the advisor asked. Before the gate, each one
    ended the consultation and offered a transfer.
    """

    @pytest.mark.parametrize(
        "cls,message",
        [
            # Medical history. The car is why they were in hospital.
            (SarahAI, "I had a car accident and was hospitalised for a week."),
            # Who to cover, and where they live.
            (SarahAI, "My parents live in the UK and visit once a year."),
            # A health benefit that happens to share travel's vocabulary.
            (SarahAI, "Does the plan cover emergency evacuation by air ambulance?"),
            # Someone else's car, mentioned in passing.
            (SarahAI, "My brother drives a car to work every day."),
            # The mirror case: a motor customer describing an injury.
            (AlexAI, "After the crash I spent three days in hospital."),
        ],
    )
    def test_a_mention_in_passing_does_not_end_the_consultation(self, cls, message):
        assert _agent(cls).check_domain_violation(message) is None

    def test_naming_our_own_domain_alongside_theirs_keeps_the_customer_here(self):
        """The customer is still on this topic; the other word is context."""
        assert (
            _agent(SarahAI).check_domain_violation(
                "I need health insurance, I had a car accident last year."
            )
            is None
        )

    def test_a_short_message_needs_no_further_evidence(self):
        """Five words or fewer is nothing but the request itself."""
        result = _agent(SarahAI).check_domain_violation("car insurance please")
        assert result is not None and result["target_name"] == "Alex AI"

    def test_the_gate_shares_its_vocabulary_with_the_interrupt_detector(self):
        """
        Two gates deciding the same question from two different word lists
        would eventually disagree, and a customer would be transferred by one
        and kept by the other on the same sentence.
        """
        from app.orchestrator import interrupt_detector

        assert base_agent.DOMAIN_KEYWORDS is interrupt_detector.DOMAIN_KEYWORDS
        assert base_agent.PRODUCT_TERM_RE is interrupt_detector.PRODUCT_TERM_RE

    @pytest.mark.parametrize(
        "message",
        [
            "I was hospitalised for a week",
            "my hospitalization was covered",
            "she was hospitalized last year",
        ],
    )
    def test_the_health_stem_actually_matches_now(self, message):
        """
        `hospitaliz` sat in the shared health list as a stem, but the pattern
        anchors with a word boundary, so it could never match the word it was
        written for. The gate leans on this list, so a dead entry there is a
        transfer offered here.
        """
        from app.orchestrator.interrupt_detector import DOMAIN_KEYWORDS

        pattern = SarahAI._own_domain_pattern()
        assert "hospitaliz" not in DOMAIN_KEYWORDS["health"]
        assert pattern.search(message), f"health vocabulary missed {message!r}"


class TestEveryAgentUsesWordBoundaries:
    """The matcher lives on the base class, so this holds for all of them."""

    @pytest.mark.parametrize("cls", [SarahAI, AlexAI, EthanAI, EmmaAI])
    def test_no_keyword_fires_from_inside_a_longer_word(self, cls):
        for domain, info in cls.FORBIDDEN_DOMAINS.items():
            for keyword in info.get("keywords", []):
                # Bury the keyword inside a longer token. A boundary-anchored
                # matcher sees nothing; a substring matcher sees a transfer.
                # Read through the matcher rather than the whole check, so the
                # request gate cannot be what makes this pass.
                buried = f"I would like to discuss x{keyword.replace(' ', 'x')}x please"
                assert not _keyword_fires(cls, buried, domain), (
                    f"{cls.NAME}: {keyword!r} fired from inside a longer word"
                )

    @pytest.mark.parametrize("cls", [SarahAI, AlexAI, EthanAI, EmmaAI])
    def test_each_agent_compiles_its_own_patterns(self, cls):
        """
        The cache is keyed in `cls.__dict__`, so one agent's compiled list can
        never be served to another. If it could, the first agent to take a turn
        would decide the boundaries for all of them.
        """
        patterns = cls._forbidden_patterns()
        assert set(patterns) == set(cls.FORBIDDEN_DOMAINS)
        assert cls.__dict__.get("_FORBIDDEN_RE") is patterns


class TestThinkingStepDomain:
    """The animation picked while the answer streams — same substring trap."""

    @pytest.mark.parametrize(
        "message",
        [
            REPORTED,
            "I want the best care for my parents.",
            "My mother needs healthcare.",
        ],
    )
    def test_a_health_message_gets_the_health_sequence(self, message):
        from app.services.stream_service import _quick_domain

        assert _quick_domain(message, None) == "health"

    @pytest.mark.parametrize(
        "message,expected",
        [
            ("My car is a 2019 Swift.", "motor"),
            ("I need travel cover abroad.", "travel"),
            ("I own a flat in Chennai.", "home-property"),
        ],
    )
    def test_a_real_domain_message_still_gets_its_own_sequence(self, message, expected):
        from app.services.stream_service import _quick_domain

        assert _quick_domain(message, None) == expected
