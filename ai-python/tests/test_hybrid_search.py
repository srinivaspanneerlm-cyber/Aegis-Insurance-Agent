"""
Tests for the offline BM25 retrieval path of the hybrid search engine (Phase 8.4).

No embedding API key is used, so these exercise the deterministic offline ranker
(BM25 + concept-intent boost). The engine builds from the repo's real
insurance-data knowledge base.
"""
import pytest

from app.config.config import settings
from app.services.hybrid_search import HybridSearchEngine, _BM25Index, _tokenize


@pytest.fixture(autouse=True)
def _force_offline_path(monkeypatch):
    """Keep these tests on the offline ranker whatever the developer's .env says.

    The engine goes online the moment a Gemini key exists, so before this the
    suite passed or failed according to whether the machine running it happened
    to have one configured — green on CI, red on the laptop of anyone who added
    a key. What is under test here is the deterministic BM25 path, so it is
    pinned rather than left to the environment.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "")


# ── BM25 unit ─────────────────────────────────────────────────────────────────

def test_bm25_ranks_the_matching_document_top():
    idx = _BM25Index(["the cat sat on the mat", "dogs chase balls", "fish swim in water"])
    s = idx.scores("cat")
    assert s[0] == max(s) and s[0] > 0     # only doc 0 contains the token "cat"
    assert s[1] == 0 and s[2] == 0


def test_bm25_scores_are_zero_for_unknown_terms():
    idx = _BM25Index(["alpha beta", "gamma delta"])
    assert idx.scores("zebra") == [0.0, 0.0]


def test_tokenize_drops_punctuation_and_single_chars():
    assert _tokenize("Section 80D: tax-benefit!") == ["section", "80d", "tax", "benefit"]


# ── Engine offline retrieval ──────────────────────────────────────────────────

def _engine():
    e = HybridSearchEngine()
    assert not e.gemini_configured, "test must run on the offline path"
    return e


def test_engine_builds_chunks_and_index():
    e = _engine()
    assert len(e.chunks) > 0
    assert e._bm25.N == len(e.chunks)


def test_offline_retrieval_top1_matches_intent():
    e = _engine()
    cases = [
        ("waiting period for pre-existing disease", "health", "Waiting"),
        ("tax exemption under section 80d",         "health", "Tax"),
        ("cashless claim process through tpa",      "health", "Claim"),
        ("cosmetic surgery is excluded",            "health", "Exclusion"),
        ("monthly premium cost",                    "motor",  "Premium"),
    ]
    for query, category, expected_section in cases:
        top = e.search(query, category, top_k=3)
        assert top, f"no results for {query!r}"
        assert expected_section.lower() in top[0].section.lower(), (
            f"{query!r} → top section {top[0].section!r}, expected ~{expected_section!r}"
        )


def test_search_is_deterministic():
    e = _engine()
    a = [c.section for c in e.search("tax 80d exemption", "health", top_k=5)]
    b = [c.section for c in e.search("tax 80d exemption", "health", top_k=5)]
    assert a == b


def test_search_respects_category_filter():
    e = _engine()
    results = e.search("premium cost coverage", "motor", top_k=5)
    assert results and all(c.category == "motor" for c in results)


def test_search_returns_at_most_top_k():
    e = _engine()
    assert len(e.search("coverage benefits claim", "health", top_k=3)) <= 3
