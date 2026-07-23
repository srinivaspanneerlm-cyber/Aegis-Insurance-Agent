"""
The evaluation harness core: run a persona through the right engine and reduce
the result to a comparable summary.

It is deliberately **LLM-free and side-effect-free**. It calls the pure,
rule-based `get_top3_recommendations` of each specialist engine directly on a
copy of the persona dict, so nothing here invokes an agent, writes a customer
profile to disk, or touches the protected orchestrator / streaming paths. That
is what makes the whole eval safe to run in CI on every push.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable, Dict

from app.agents import health_engine, motor_engine, property_engine, travel_engine

# domain → the engine's stable public entry point
ENGINES: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
    "health": health_engine.get_top3_recommendations,
    "motor": motor_engine.get_top3_recommendations,
    "travel": travel_engine.get_top3_recommendations,
    "property": property_engine.get_top3_recommendations,
}

# Every engine's per-plan score block carries exactly these dimensions.
SCORE_DIMENSIONS = {"budget_match", "coverage_match", "overall", "risk_match", "suitability"}

# The segment tiers every engine classifies into, low → high. Used to assert a
# bigger budget never drops a customer into a lower tier.
SEGMENT_RANK = {"Budget": 0, "Standard": 1, "Premium": 2}

GOLDEN_DIR = Path(__file__).parent / "golden"
# Set this env var to rewrite the baselines after an *intended* engine change.
UPDATE = os.getenv("UPDATE_EVAL_GOLDEN") == "1"


def recommend(domain: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Run one persona through its engine. Copies the profile so a shared
    persona fixture can never be mutated by the engine."""
    return ENGINES[domain](dict(profile))


def summarise(envelope: Dict[str, Any]) -> Dict[str, Any]:
    """Reduce an envelope to the *decisions* a regression baseline should pin:
    the segment, the recommended plan, and each ranked plan's name and overall
    score. Advisory prose and volatile sub-scores are excluded on purpose — the
    baseline tracks what the customer is offered, not how it is worded."""
    return {
        "segment": envelope["segment"],
        "recommended": envelope["recommended"],
        "ranking": [
            {"rank": p["rank"], "plan_name": p["plan_name"], "overall": p["scores"]["overall"]}
            for p in envelope["plans"]
        ],
    }


def load_golden(name: str) -> Dict[str, Any]:
    path = GOLDEN_DIR / name
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_golden(name: str, data: Dict[str, Any]) -> None:
    GOLDEN_DIR.mkdir(exist_ok=True)
    path = GOLDEN_DIR / name
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
