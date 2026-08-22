"""
What the voice layer is allowed to influence, and what it must not touch.

Almost every test here is a containment test. Adaptation is a nicety — a reply
phrased more plainly, an answer that gets to the point — and the cost of getting
it wrong ranges from mildly odd to a customer being told something untrue about
their insurance in their own words. So the interesting assertions are the
negative ones: that a style cannot reach a price, that an unknown value becomes
the old behaviour rather than an error, and that a typed turn produces the
prompt it always produced.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.prompts.voice_style_prompts import voice_style_prompt
from app.services.voice_context import (
    STYLE_BRIEF,
    STYLE_CONFUSED,
    STYLE_FRUSTRATED,
    STYLE_NORMAL,
    STYLE_URGENT,
    VOICE_STYLES,
    VoiceTurnContext,
    build_voice_context,
    current_voice_context,
    normalise_style,
    set_voice_context,
)


@pytest.fixture(autouse=True)
def clean_context():
    set_voice_context(None)
    yield
    set_voice_context(None)


class TestFallback:
    """Adaptation failing must cost the customer nothing but the adaptation."""

    @pytest.mark.parametrize(
        "raw", [None, "", "   ", "excited", "SAD", 42, [], {"style": "x"}, "'; drop table"]
    )
    def test_anything_unrecognised_becomes_the_old_behaviour(self, raw):
        assert normalise_style(raw) == STYLE_NORMAL

    def test_every_known_style_survives_normalisation(self):
        for style in VOICE_STYLES:
            assert normalise_style(style) == style
            assert normalise_style(f"  {style.upper()}  ") == style

    def test_a_typed_turn_has_no_context_at_all(self):
        # The guarantee that keeps typed chat unchanged: no block, no
        # adaptation, the same prompt as before.
        assert build_voice_context(None) is None
        assert build_voice_context({}) is None
        assert build_voice_context({"spoken": False, "style": "urgent"}) is None

    def test_a_malformed_payload_does_not_raise(self):
        assert build_voice_context("not a dict") is None
        assert build_voice_context([1, 2, 3]) is None

    def test_an_overlong_language_tag_is_dropped_rather_than_carried(self):
        context = build_voice_context({"style": "normal", "language": "x" * 200})
        assert context.language is None


class TestTheContextItself:
    def test_it_carries_what_the_browser_observed(self):
        context = build_voice_context({"style": "confused", "language": "ta-en"})
        assert context.style == STYLE_CONFUSED
        assert context.language == "ta-en"
        assert context.spoken is True

    def test_normal_is_not_worth_adapting_for(self):
        assert VoiceTurnContext(style=STYLE_NORMAL).adapts() is False
        assert VoiceTurnContext(style=STYLE_URGENT).adapts() is True

    def test_a_typed_turn_adapts_nothing_even_with_a_style(self):
        assert VoiceTurnContext(style=STYLE_URGENT, spoken=False).adapts() is False

    def test_the_stage_travels_back_out(self):
        # The two-way channel: the browser puts in what it observed, the turn
        # puts back where the middleware placed it — so the voice layer needs no
        # second state machine and no round trip to fetch one.
        context = VoiceTurnContext()
        context.record_stage("Data Collection", "general")
        assert context.conversation_state == "Data Collection"
        assert context.intent == "general"

    def test_the_slot_is_empty_until_something_installs_one(self):
        assert current_voice_context() is None
        context = VoiceTurnContext()
        set_voice_context(context)
        assert current_voice_context() is context


class TestThePromptBlocks:
    def test_a_typed_turn_gets_no_block(self):
        assert voice_style_prompt(STYLE_CONFUSED, spoken=False) == ""

    def test_every_spoken_turn_is_told_it_will_be_read_aloud(self):
        # The one adaptation every voice turn deserves regardless of style: a
        # reply about to be spoken should not contain a markdown table.
        for style in VOICE_STYLES:
            block = voice_style_prompt(style)
            assert "read aloud" in block
            assert "markdown" in block

    def test_an_unknown_style_still_produces_a_usable_block(self):
        block = voice_style_prompt("something-else")
        assert "read aloud" in block

    @pytest.mark.parametrize(
        "style,expected",
        [
            (STYLE_CONFUSED, "plainer words"),
            (STYLE_FRUSTRATED, "Acknowledge"),
            (STYLE_URGENT, "time pressure"),
            (STYLE_BRIEF, "short, direct"),
        ],
    )
    def test_each_style_says_something_specific(self, style, expected):
        assert expected in voice_style_prompt(style)

    def test_no_block_tells_the_agent_what_the_customer_feels(self):
        # Aegis cannot know that, and an advisor that announced its guess would
        # be wrong in public about a person's own words. The blocks describe the
        # message, never the person.
        for style in VOICE_STYLES:
            block = voice_style_prompt(style).lower()
            for claim in (
                "the customer is frustrated",
                "the customer is confused",
                "the customer is angry",
                "the customer feels",
                "they are upset",
                "they feel",
            ):
                assert claim not in block

    def test_every_block_forbids_narrating_the_adaptation(self):
        for style in VOICE_STYLES:
            assert "Never mention" in voice_style_prompt(style)

    def test_no_block_touches_what_the_agent_decides(self):
        # The containment claim, asserted rather than trusted.
        for style in VOICE_STYLES:
            block = voice_style_prompt(style)
            assert "do\nnot change" in block or "do not change" in block.replace("\n", " ")
            for forbidden in ("recommend a", "premium of", "eligible for", "discount"):
                assert forbidden not in block.lower()

    def test_brevity_never_licenses_dropping_a_condition(self):
        # "Be concise" is an invitation to skip a disclosure, and in insurance
        # the skipped sentence is usually the one that mattered.
        urgent = voice_style_prompt(STYLE_URGENT).lower()
        assert "condition" in urgent and "caveat" in urgent
