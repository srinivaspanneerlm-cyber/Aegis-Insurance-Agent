"""
Which agent turn counts as "the question the customer just answered".

Context-aware extraction infers a field from the previous agent turn, so what
that turn is taken to be decides where a reply gets filed. Handing it the whole
turn was the bug: once an agent narrated a plan table, the prose matched the
keyword lists for several fields at once and the customer's next sentence was
recorded as their medical history — a wrong fact, persisted, on the profile the
recommendation is scored from.

These tests pin the narrow reading: the final question of a consultation turn,
and nothing at all from a turn that never asked one — plus the phrasing a
customer actually uses when they answer, which has to survive the trip into a
field or the advisor asks the same question forever.
"""
from app.memory.memory_orchestrator import trailing_question
import pytest

from app.memory.profile_manager import EnhancedProfileManager


# The real pipeline questions, verbatim from SarahAI.QUESTION_PIPELINE.
COVERAGE_Q = (
    "Who would you like to insure — just yourself, your immediate family, "
    "or do you also need to cover parents or senior members?"
)
AGE_Q = "What's the age of the eldest person we're covering? That's the key driver for premium."

# The narration that caused the corruption: a plan table, no question in it.
PLAN_NARRATION = (
    "Aama, therinjuchen.\n\n"
    "| Plan | Monthly Premium | Sum Insured | Key Benefits |\n"
    "| **Aegis Supreme Health Shield** | ₹850 | ₹1 Crore | Covers the whole family, "
    "cash-less at most Chennai hospitals, no pre-existing surprises |\n\n"
    "Why this is the best pick: ₹850 keeps you under budget."
)


class TestTrailingQuestion:
    def test_a_consultation_turn_yields_its_question(self):
        # The interrogative sentence only — the advisory line that follows it
        # ("That's the key driver for premium.") is not part of the ask.
        assert trailing_question(f"That helps a lot. {AGE_Q}") == (
            "What's the age of the eldest person we're covering?"
        )

    def test_only_the_final_question_is_taken(self):
        turn = "Got it. Are you married? And how many people in total would be covered?"
        assert trailing_question(turn) == "And how many people in total would be covered?"

    def test_a_narration_with_no_question_yields_nothing(self):
        # The whole point: prose full of "Sum Insured" / "pre-existing" / "covers
        # the whole family" must not be offered to the extractor as context.
        assert trailing_question(PLAN_NARRATION) == ""

    def test_empty_and_missing_turns_are_safe(self):
        assert trailing_question("") == ""
        assert trailing_question("Thanks, glad that helped.") == ""


class TestExtractionUsesTheQuestionOnly:
    """The corruption, reproduced end to end through the real extractor."""

    def test_a_reply_after_a_plan_table_is_not_filed_as_a_fact(self, tmp_path):
        mgr = EnhancedProfileManager(tmp_path)
        # What actually happened: the customer asks for plans, and that sentence
        # was stored as both coverage_type and medical_history.
        extracted = mgr.context_aware_extract(
            "Yes please recommend the best plans for us.",
            trailing_question(PLAN_NARRATION),
        )
        assert extracted == {}, f"narration context invented fields: {extracted}"

    def test_the_coverage_answer_is_kept_as_the_customer_said_it(self, tmp_path):
        mgr = EnhancedProfileManager(tmp_path)
        extracted = mgr.context_aware_extract(
            "Just myself, my wife and our one child.",
            trailing_question(f"Got it. {COVERAGE_Q}"),
        )
        assert extracted.get("coverage_type") == "Just myself, my wife and our one child."
        # And it is not double-counted as a household of one: the coverage
        # question and the family-size question share the words "insure"/"cover".
        assert "family_size" not in extracted

    def test_a_bare_number_after_the_age_question_is_an_age(self, tmp_path):
        mgr = EnhancedProfileManager(tmp_path)
        extracted = mgr.context_aware_extract("32", trailing_question(AGE_Q))
        assert extracted.get("age") == 32


class TestBudgetPhrasingSurvives:
    """
    The loop this closed: with plans withheld until the pipeline completes, a
    budget the extractor could not read meant the advisor re-asked for it every
    turn and never reached a recommendation.
    """

    @pytest.mark.parametrize(
        "answer,expected",
        [
            ("Our budget is around 1000 per month.", 1000.0),  # the one that looped
            ("budget 2500", 2500.0),
            ("my budget of about 1500", 1500.0),
            ("budget is roughly rs 800", 800.0),
        ],
    )
    def test_hedged_budget_answers_are_read(self, tmp_path, answer, expected):
        mgr = EnhancedProfileManager(tmp_path)
        assert mgr._fallback_extract(answer).get("budget") == expected

    def test_a_number_that_is_not_a_budget_is_left_alone(self, tmp_path):
        mgr = EnhancedProfileManager(tmp_path)
        extracted = mgr._fallback_extract("My budget depends on the plan, we are 3 people")
        assert "budget" not in extracted
