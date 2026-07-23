"""
Regression baseline: pin the engine's *decision* for every persona.

The quality invariants prove a recommendation is well-formed; this proves it is
the *same* one as last time. For each persona we store the segment, the
recommended plan, and the ranked plan names + overall scores in a committed
golden file. Any engine change that moves a recommendation shows up as a diff a
reviewer must consciously accept.

After an intended change, regenerate the baseline with:

    UPDATE_EVAL_GOLDEN=1 pytest tests/eval/test_recommendation_regression.py

and review the resulting diff to `golden/recommendations.json` before committing.
"""
from __future__ import annotations

import pytest

from .harness import UPDATE, load_golden, recommend, summarise, write_golden
from .personas import PERSONAS

GOLDEN = "recommendations.json"


def _current() -> dict:
    return {p["id"]: summarise(recommend(p["domain"], p["profile"])) for p in PERSONAS}


@pytest.fixture(scope="module", autouse=True)
def _maybe_regenerate():
    if UPDATE:
        write_golden(GOLDEN, _current())
    yield


def test_baseline_exists_for_every_persona():
    golden = load_golden(GOLDEN)
    assert golden, "no golden baseline — run once with UPDATE_EVAL_GOLDEN=1"
    assert set(golden) == {p["id"] for p in PERSONAS}, "persona set drifted from the baseline"


@pytest.mark.parametrize("persona", [pytest.param(p, id=p["id"]) for p in PERSONAS])
def test_recommendation_matches_baseline(persona):
    golden = load_golden(GOLDEN)
    expected = golden.get(persona["id"])
    assert expected is not None, f"{persona['id']} not in baseline — regenerate with UPDATE_EVAL_GOLDEN=1"
    actual = summarise(recommend(persona["domain"], persona["profile"]))
    assert actual == expected, (
        f"{persona['id']} recommendation drifted from baseline.\n"
        f"expected={expected}\nactual={actual}\n"
        "If this change is intended, regenerate with UPDATE_EVAL_GOLDEN=1 and review the diff."
    )
