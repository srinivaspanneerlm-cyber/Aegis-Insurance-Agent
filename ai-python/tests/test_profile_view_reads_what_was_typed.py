"""
The profile view is built from what the customer typed, not from a form.

Every specialist agent runs this middleware before its LLM call, and it reads
the stored profile — fields that hold a customer's own words. Asking "how many
members?" in plain language invites "3 per, naan 32 vayasu wife 30 kid 5", and
casting that with int() raised ValueError out of the middleware, past the
agent, and into the turn: the customer got "I'm experiencing a brief
interruption" instead of the recommendation they were two answers away from.

A provider fallback cannot save this — the crash happens before any LLM is
called. So it is pinned here.
"""
from app.middleware.conversation_middleware import CustomerProfileView


def _view(**profile):
    return CustomerProfileView.from_profile(profile)


# ── The sentence answers this product asks for ────────────────────────────────


def test_a_thanglish_sentence_answer_does_not_lose_the_turn():
    view = _view(family_size="3 per, naan 32 vayasu wife 30 kid 5")
    assert view.memberCount == 3
    assert view.coverageType == "family"


def test_an_age_written_as_a_sentence_is_read_as_a_number():
    view = _view(age="naan 32 vayasu")
    assert view.eldestAge == 32


def test_a_budget_written_with_a_magnitude_is_read_as_rupees():
    # "15k" is fifteen thousand rupees. Read as 15, it put the customer in the
    # cheapest segment and scored every plan against a budget they never named.
    view = _view(budget="15k per month")
    assert view.monthlyBudget == 15000


def test_a_whole_profile_of_typed_answers_summarises_cleanly():
    # The summary is prompt context: whatever lands here is what the agent is
    # told about the customer, so a raw sentence in a member count is not just
    # untidy, it is wrong information handed to the model.
    view = _view(
        family_size="3 per",
        age="naan 32 vayasu",
        location="Coimbatore",
        budget="15k",
        medical_history="none",
    )
    summary = view.as_summary()
    assert "3 members" in summary
    assert "eldest age 32" in summary
    assert "₹15,000/month budget" in summary


# ── The values that already worked keep working ───────────────────────────────


def test_a_plain_integer_member_count_is_unchanged():
    assert _view(family_size=1).coverageType == "individual"
    assert _view(family_size=4).memberCount == 4
    assert _view(family_size=4).coverageType == "family"


def test_a_numeric_string_member_count_is_read_as_that_number():
    # "1" and 1 are the same answer typed two ways; before this they took
    # different branches, and "1" was never individual cover.
    assert _view(family_size="1").coverageType == "individual"


def test_an_empty_profile_stays_empty_rather_than_guessing():
    view = _view()
    assert view.memberCount is None
    assert view.eldestAge is None
    assert view.monthlyBudget is None
    assert view.coverageType is None
    assert view.as_summary() == "(no profile data yet)"


def test_an_answer_with_no_number_in_it_is_not_invented():
    # "just me and my wife" carries no digit. None keeps the field on the
    # missing list so the agent asks again, which is the honest outcome.
    view = _view(family_size="just me and my wife")
    assert view.memberCount is None
    assert "Who to cover / how many members" in view.missing_field_labels()
