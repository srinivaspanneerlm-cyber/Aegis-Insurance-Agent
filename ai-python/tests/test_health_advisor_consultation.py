"""
The health consultation reaches a plan by consultation, not by arithmetic.

The defect these pin: a customer opening with "I need help choosing health
insurance" was shown three ranked plans on that first message. Their facts were
already on disk from an earlier session, so the only unanswered pipeline step
left was `recommendation_confirmed` — and the profile writer fills the next
unanswered step with whatever was typed. The opening line was recorded as the
customer's consent to see plans, the pipeline read as complete, and the engine
ran before the advisor had asked a single question.

So the rules that matter here are about what must NOT happen yet. Discovery
runs first; the requirements are read back and confirmed; permission is asked
and given; and only then does the engine choose — one plan, with its reasons,
and the rest of the catalogue stays where it is until someone asks for it.

Everything runs against a temporary memory directory. An agent handed the real
one writes to the customer profiles under Aegis-AI/layer3.
"""
import asyncio

import pytest

from app.agents.base_agent import is_agreement
from app.agents.sarah_ai import SarahAI
from app.agents.health_engine import get_best_fit_recommendation
from app.memory.memory_orchestrator import MemoryOrchestrator
from app.utils.customer_identity import derive_customer_id


# The eight things Sarah asks before she is allowed to recommend anything.
DATA_FIELDS = [
    "coverage_type", "family_size", "age", "primary_concern",
    "existing_coverage", "location", "budget", "medical_history",
]

# A profile that has answered all of them — the returning customer whose data
# is already on disk, which is the case that broke.
FULL_PROFILE = {
    "coverage_type":     "Myself and my parents",
    "family_size":       3,
    "age":               62,
    "primary_concern":   "unexpected medical expenses",
    "existing_coverage": "basic cover through my employer",
    "location":          "Chennai",
    "budget":            2500,
    "medical_history":   "none",
}


class _StubLLM:
    """Records the prompt it was handed; the reply itself is never the subject."""

    def __init__(self):
        self.prompts = []

    async def generate_response(self, system_prompt, user_message, history, tools=None):
        self.prompts.append(system_prompt)
        return "(advisor reply)"


@pytest.fixture
def agent(tmp_path):
    """Sarah, wired to a memory directory that is not the repository's."""
    sarah = SarahAI(_StubLLM(), None, None)
    sarah._memory_orch = MemoryOrchestrator(tmp_path, None)
    return sarah


def seed(agent, customer_id, **fields):
    """Put a profile on disk the way an earlier session would have left it."""
    agent._memory_orch.profile_manager.save_domain_profile(
        f"health_{customer_id}",
        {"customer_id": f"health_{customer_id}", **fields},
    )


def turn(agent, customer_id, message, last_agent_question=""):
    """One customer message. Returns (profile, questions still outstanding)."""
    if last_agent_question:
        agent._memory_orch.save_turn(
            customer_id, "health", "(earlier)", last_agent_question
        )
    profile = agent.update_profile(customer_id, message, "Test Customer")
    return profile, agent._check_missing_details(profile)


# ── Discovery: nothing is shown while questions remain ────────────────────────


class TestNoPlanDuringDiscovery:
    def test_the_opening_line_shows_nothing(self, agent):
        # Spec case 1, and the reported bug in its original form.
        _, missing = turn(agent, "cust_new", "I need help choosing health insurance")
        assert len(missing) == len(SarahAI.QUESTION_PIPELINE)

    def test_the_opening_line_is_not_read_as_consent(self, agent):
        # The actual mechanism. Every fact is already known, so consent is the
        # only thing left to fill — and it must not be filled by this.
        seed(agent, "cust_returning", **FULL_PROFILE)
        profile, missing = turn(
            agent, "cust_returning", "I need help choosing health insurance"
        )
        assert not profile.get("recommendation_confirmed")
        assert not profile.get("profile_confirmed")
        assert missing, "a returning customer was walked straight into a recommendation"

    def test_an_age_alone_leaves_the_consultation_running(self, agent):
        # Spec case 2.
        profile, missing = turn(
            agent, "cust_partial", "27",
            last_agent_question="How old are you?",
        )
        assert profile.get("age") == 27
        assert missing

    def test_asking_which_plan_to_choose_does_not_produce_one(self, agent):
        # Spec case 4. The question is a question, not an answer, and not a
        # licence to skip the rest of the consultation.
        seed(agent, "cust_impatient", coverage_type="myself", family_size=1)
        profile, missing = turn(
            agent, "cust_impatient", "Which plan should I choose?",
            last_agent_question="How old are you?",
        )
        assert missing
        assert not profile.get("recommendation_confirmed")

    def test_an_answer_still_lands_when_the_turn_asked_no_literal_question(self, agent):
        """The other half of the opening-line fix, and the loop it must avoid.

        Filing a reply positionally needs an advisor turn for it to be a reply
        to — but not a parseable question mark. An advisor turn that ends in a
        statement still expects an answer, and dropping it means the same step
        is asked forever and the consultation never reaches a recommendation.
        """
        cid = "cust_statement"
        agent._memory_orch.save_turn(
            cid, "health", "(earlier)",
            "Tell me who you'd like to insure.",  # no "?" anywhere
        )
        profile, _ = turn(agent, cid, "Myself and my parents")
        assert profile.get("coverage_type") == "Myself and my parents"

    def test_partial_answers_keep_the_advisor_asking(self, agent):
        # Spec case 3 — each answer clears exactly one step, in order.
        cid = "cust_progressive"
        before = len(agent._check_missing_details({}))
        turn(agent, cid, "Myself and my parents",
             last_agent_question="Who would you like to insure?")
        _, after = turn(agent, cid, "Three of us",
                        last_agent_question="How many people in total?")
        assert len(after) == before - 2


# ── The two gates ─────────────────────────────────────────────────────────────


class TestGates:
    def test_the_summary_comes_before_the_permission_request(self, agent):
        seed(agent, "cust_gates", **FULL_PROFILE)
        _, missing = turn(agent, "cust_gates", "hello again")
        # Spec case 5: everything is known, so what is outstanding is the
        # read-back — and after it, the request for permission.
        assert missing == ["SUMMARY_STEP", "CONFIRMATION_STEP"]

    def test_confirming_the_summary_is_not_consent_to_see_a_plan(self, agent):
        # Spec cases 6 and 7. One "yes" answers one question. Reading it as
        # both would put a plan on screen in the turn the customer was still
        # checking their own details.
        seed(agent, "cust_one_yes", **FULL_PROFILE)
        profile, missing = turn(
            agent, "cust_one_yes", "Yes, that's right",
            last_agent_question="Have I got that right?",
        )
        assert profile.get("profile_confirmed") == "yes"
        assert not profile.get("recommendation_confirmed")
        assert missing == ["CONFIRMATION_STEP"]

    def test_a_correction_does_not_pass_the_gate(self, agent):
        seed(agent, "cust_correcting", **FULL_PROFILE)
        profile, _ = turn(
            agent, "cust_correcting",
            "No, my father is actually 65 not 62",
            last_agent_question="Have I got that right?",
        )
        assert not profile.get("profile_confirmed")

    def test_consent_completes_the_pipeline(self, agent):
        # Spec case 8.
        seed(agent, "cust_consenting", **FULL_PROFILE, profile_confirmed="yes")
        profile, missing = turn(
            agent, "cust_consenting", "Yes, please. Go ahead.",
            last_agent_question="Would you like me to show you why?",
        )
        assert profile.get("recommendation_confirmed") == "yes"
        assert missing == []

    def test_going_ahead_means_show_me_not_buy_it(self, agent):
        """"Yes, please. Go ahead." is how the spec's customer consents to see
        the recommendation — and it is also, word for word, how someone says
        they want to buy. Read as a purchase it sent them to the payment steps
        on the one turn the plan was supposed to appear."""
        from app.middleware.conversation_middleware import ConversationIntent

        ctx = agent._middleware.analyze(
            message="Yes, please. Go ahead.",
            profile=FULL_PROFILE,
            history=[{"role": "assistant", "content": "Shall I show you why?"}],
            existing_recommendation=None,   # nothing has been recommended yet
            pipeline_complete=True,
        )
        assert ctx.intent != ConversationIntent.PURCHASE

    def test_the_same_words_do_mean_buy_once_a_plan_is_on_screen(self, agent):
        from app.middleware.conversation_middleware import ConversationIntent

        ctx = agent._middleware.analyze(
            message="Yes, please. Go ahead.",
            profile=FULL_PROFILE,
            history=[{"role": "assistant", "content": "Here is the plan."}],
            existing_recommendation=get_best_fit_recommendation(FULL_PROFILE),
            pipeline_complete=True,
        )
        assert ctx.intent == ConversationIntent.PURCHASE

    def test_a_passed_gate_survives_a_reload(self, agent):
        seed(agent, "cust_persisted", **FULL_PROFILE)
        turn(agent, "cust_persisted", "Yes, exactly",
             last_agent_question="Have I got that right?")
        reloaded = agent.load_profile("cust_persisted")
        assert reloaded.get("profile_confirmed") == "yes"

    @pytest.mark.parametrize("reply", [
        "Yes", "Sure", "Please", "Go ahead", "Yes, tell me",
        "Come on, tell me", "Show me", "Okay", "seri", "aama",
    ])
    def test_the_ways_people_actually_say_yes(self, reply):
        assert is_agreement(reply)

    @pytest.mark.parametrize("reply", [
        "Ok but my father is actually 65",
        "No",
        "Not quite right",
        "I need help choosing health insurance",
        "Actually, can you change the budget to 3000",
    ])
    def test_replies_that_are_not_agreement(self, reply):
        assert not is_agreement(reply)


# ── The engine decides, and it decides once ───────────────────────────────────


class TestTheEngineChooses:
    def test_one_plan_is_returned(self, agent):
        # Spec case 9.
        result = agent.recommend(FULL_PROFILE, "health")
        assert result["type"] == "single_plan"
        assert len(result["plans"]) == 1

    def test_the_plan_carries_the_reasons_it_won(self, agent):
        result = agent.recommend(FULL_PROFILE, "health")
        assert result["reason_codes"], "a recommendation with no stated reason"
        # Traceable to what the customer said, not invented alongside it.
        joined = " ".join(result["reason_codes"]).lower()
        assert "unexpected medical expenses" in joined

    def test_the_chosen_plan_comes_from_the_catalogue(self, agent):
        # Spec case 10, at its source: the name and the price are the engine's,
        # so there is nothing for a model to compose.
        from app.agents.health_plans import HEALTH_PLANS

        plan = agent.recommend(FULL_PROFILE, "health")["plans"][0]
        catalogue = {p["plan_id"]: p for p in HEALTH_PLANS.values()}
        assert plan["plan_id"] in catalogue
        assert plan["plan_name"] == catalogue[plan["plan_id"]]["plan_name"]

    def test_the_best_fit_is_the_plan_that_ranked_first(self, agent):
        """One scoring pass, two presentations of it — not two engines."""
        from app.agents.health_engine import get_top3_recommendations

        shortlist = get_top3_recommendations(FULL_PROFILE)
        best = get_best_fit_recommendation(FULL_PROFILE)
        assert best["plans"][0]["plan_id"] == shortlist["plans"][0]["plan_id"]

    def test_an_alternative_is_a_different_plan(self, agent):
        first = get_best_fit_recommendation(FULL_PROFILE)
        shown = [p["plan_id"] for p in first["plans"]]
        second = get_best_fit_recommendation(FULL_PROFILE, exclude_plan_ids=shown)
        assert second["plans"][0]["plan_id"] not in shown

    def test_running_out_of_alternatives_returns_nothing_rather_than_repeating(self):
        everything = [
            p["plan_id"]
            for p in get_best_fit_recommendation(FULL_PROFILE)["plans"]
        ]
        exhausted = FULL_PROFILE
        # Exclude every plan in the segment.
        from app.agents.health_engine import classify_segment, analyse_risk, _rank_segment_plans

        all_ids = [
            p["plan_id"]
            for p in _rank_segment_plans(
                exhausted, analyse_risk(exhausted), classify_segment(exhausted)
            )
        ]
        assert get_best_fit_recommendation(exhausted, exclude_plan_ids=all_ids) is None
        assert everything  # sanity: there was something to exclude


# ── Alternatives are offered, not dumped ──────────────────────────────────────


class TestAlternatives:
    def _ctx(self, agent, message, profile, existing_rec):
        return agent._middleware.analyze(
            message=message,
            profile=profile,
            history=[{"role": "user", "content": "..."}],
            existing_recommendation=existing_rec,
            pipeline_complete=True,
        )

    def test_asking_for_another_option_offers_rather_than_shows(self, agent):
        # Spec case 11.
        rec = get_best_fit_recommendation(FULL_PROFILE)
        ctx = self._ctx(agent, "Can you show me another option?", FULL_PROFILE, rec)
        assert ctx.offer_alternatives
        assert not ctx.force_compare

    def test_agreeing_to_the_offer_produces_one(self, agent):
        rec = get_best_fit_recommendation(FULL_PROFILE)
        profile = {**FULL_PROFILE, "alternative_offered": "yes"}
        ctx = self._ctx(agent, "Yes please", profile, rec)
        assert ctx.force_compare
        assert not ctx.locked, "a locked turn cannot generate the alternative"

    def test_asking_about_cheaper_plans_mid_discovery_does_not_derail_it(self, agent):
        """There is nothing to be an alternative to yet, and offering one would
        abandon a consultation that has not finished asking."""
        partial = {"coverage_type": "myself", "family_size": 1}
        ctx = self._ctx(agent, "Is there anything cheaper?", partial, None)
        assert not ctx.offer_alternatives
        assert not ctx.force_compare

    def test_an_unrelated_reply_lets_the_offer_lapse(self, agent):
        rec = get_best_fit_recommendation(FULL_PROFILE)
        profile = {**FULL_PROFILE, "alternative_offered": "yes"}
        ctx = self._ctx(agent, "What is the waiting period?", profile, rec)
        assert not ctx.force_compare
        assert not ctx.offer_alternatives


# ── What reaches the customer ─────────────────────────────────────────────────


class TestTheReplyItself:
    """Through the real turn, so the customer id is the one the agent derives."""

    def test_no_card_is_attached_while_questions_remain(self, agent):
        cid = derive_customer_id("Test Customer", None, "sess-1")
        seed(agent, cid, coverage_type="myself", family_size=1)
        reply = asyncio.run(agent.generate_response(
            "Which plan should I choose?", [], "Test Customer", "sess-1"
        ))
        assert "[RECOMMENDATION:" not in reply

    def test_the_card_is_attached_once_consent_is_given(self, agent):
        cid = derive_customer_id("Test Customer", None, "sess-2")
        seed(
            agent, cid, **FULL_PROFILE,
            profile_confirmed="yes", recommendation_confirmed="yes",
        )
        reply = asyncio.run(agent.generate_response(
            "Yes, show me", [], "Test Customer", "sess-2"
        ))
        assert reply.count("[RECOMMENDATION:") == 1
        assert '"single_plan"' in reply

    def test_the_summary_prompt_forbids_naming_a_plan(self, agent):
        cid = derive_customer_id("Test Customer", None, "sess-3")
        seed(agent, cid, **FULL_PROFILE)
        asyncio.run(agent.generate_response("hello", [], "Test Customer", "sess-3"))
        prompt = agent.llm.prompts[-1]
        assert "READ THE REQUIREMENTS BACK" in prompt
        # The engine has not run, so the prompt carries no plan for the model to
        # leak — and says so in as many words.
        assert "ABSOLUTELY FORBIDDEN" in prompt
