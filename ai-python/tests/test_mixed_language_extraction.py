"""
Field extraction from code-switched (mixed Tamil-English / Thanglish) turns.

`test_advisor_language.py` already proves the *language-request* detector
correctly tells "writing in Thanglish" apart from "asking for Thanglish". What
had no coverage is the separate question of whether the *consultation
pipeline's* own field extraction (age, budget, family size) still works when
the sentence carrying those facts is itself code-switched — the everyday case
for this product's actual users.

Driven through `MemoryOrchestrator.update_profile` with no memory_engine, which
runs `EnhancedProfileManager._fallback_extract` — regex extraction anchored on
the literal English keyword next to each field ("age 32", "budget 15000").
This is not a stand-in for a different, smarter path: the real Layer 3 engine
(`Aegis-AI/layer3/engine.py::extract_from_message`) uses the *identical* regex
for age/budget, kept in step by comment on both sides — confirmed by reading
both files. So what this proves about the fallback is true of production too.

Findings are recorded as characterization, not asserted as correct-or-wrong:
an English anchor word survives being embedded in an otherwise Tamil/Thanglish
sentence; a fact phrased with no English anchor word at all does not extract.
Changing that is an extraction-quality improvement to the consultation
pipeline — business logic CLAUDE.md reserves for a task that asks for it
explicitly — so it is reported here, not fixed.
"""
from app.memory.memory_orchestrator import MemoryOrchestrator


def _orch(tmp_path):
    return MemoryOrchestrator(tmp_path, None)


# ── English anchor word survives code-switching around it ──────────────────────

def test_age_extracts_from_a_thanglish_sentence_carrying_the_english_word(tmp_path):
    orch = _orch(tmp_path)
    profile = orch.update_profile(
        "cust_priya", "health", "enakku age 32 dhaan, budget 15000 per month",
    )
    assert profile.get("age") == 32
    assert profile.get("budget") == 15000.0


def test_budget_extracts_when_the_rest_of_the_sentence_is_tamil_script(tmp_path):
    orch = _orch(tmp_path)
    profile = orch.update_profile(
        "cust_arjun", "motor", "budget 8000 dhaan irukku, adhukulla plan venum",
    )
    assert profile.get("budget") == 8000.0


# ── No English anchor word — documented current limitation, not a regression ───

def test_age_phrased_purely_in_tamil_vocabulary_does_not_extract(tmp_path):
    """"vayasu" is the Tamil word for age; the extractor has no rule for it.
    This is today's real behavior, not a desired outcome — recorded so a
    future change to extraction is a deliberate decision, not a silent one."""
    orch = _orch(tmp_path)
    profile = orch.update_profile(
        "cust_kumar", "health", "naan 32 vayasu, family size 4",
    )
    assert "age" not in profile
    # The English-anchored field alongside it still extracts correctly —
    # confirms the miss above is about "vayasu" specifically, not the message
    # being mixed-language in general.
    assert profile.get("family_size") == 4


# ── Both facts in one clause, English and Tamil intermixed ────────────────────

def test_two_facts_in_one_code_switched_clause_both_extract(tmp_path):
    orch = _orch(tmp_path)
    profile = orch.update_profile(
        "cust_lakshmi", "health", "naan age 40, en budget 20000 dhaan",
    )
    assert profile.get("age") == 40
    assert profile.get("budget") == 20000.0
