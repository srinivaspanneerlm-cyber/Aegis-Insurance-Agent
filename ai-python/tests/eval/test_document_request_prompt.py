"""
The document-request block: is it wired in, and does it agree with the UI?

The tag an agent writes is only useful if the frontend can parse it, so the
valuable test here is a contract test across the two codebases — the `kind` ids
this prompt teaches must be ids the UI's registry actually knows, and the example
payload must parse under the same rules `parseDocumentRequest.ts` applies.

Nothing here calls an LLM or an agent's `generate_response`: that method updates
the customer profile on disk, and a test must never edit real customer data.
"""
from __future__ import annotations

import inspect
import json
import re
from pathlib import Path

import pytest

from app.agents.base_agent import BaseInsuranceAgent
from app.prompts.document_prompts import (
    DOCUMENT_REQUEST_PROMPT,
    get_document_request_prompt,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
REGISTRY_TS = REPO_ROOT / "frontend/src/lib/documents/registry.ts"

TAG_PATTERN = re.compile(r"\[DOCUMENT_REQUEST:(\{.*\})\]")


def _example_payload() -> dict:
    match = TAG_PATTERN.search(DOCUMENT_REQUEST_PROMPT)
    assert match, "the block must show the agent a complete example tag"
    return json.loads(match.group(1))


# ── Wiring ───────────────────────────────────────────────────────────────────

def test_every_agent_receives_the_block():
    """One composition point feeds all five agents (base_agent step 5c)."""
    source = inspect.getsource(BaseInsuranceAgent.generate_response)
    assert "DOCUMENT_REQUEST_PROMPT" in source


def test_the_accessor_returns_the_same_text():
    assert get_document_request_prompt() == DOCUMENT_REQUEST_PROMPT


# ── The tag itself ───────────────────────────────────────────────────────────

def test_the_example_tag_is_parseable_json():
    """A malformed example teaches every agent to emit malformed tags."""
    payload = _example_payload()
    assert isinstance(payload, dict)


def test_the_example_matches_what_the_ui_expects():
    payload = _example_payload()

    documents = payload.get("documents")
    assert isinstance(documents, list) and documents, "`documents` carries the ask"

    for entry in documents:
        # parseDocumentRequest drops a requirement with no `kind`, so an example
        # without one would teach agents to emit a request that renders nothing.
        assert entry.get("kind"), "every document needs a `kind`"
        assert isinstance(entry["kind"], str)
        if "label" in entry:
            assert isinstance(entry["label"], str)


def test_the_tag_follows_the_house_convention():
    """Same `[NAME:{json}]` shape as [RECOMMENDATION:…], which the shared
    tagParser already handles — no second parser to keep in step."""
    assert DOCUMENT_REQUEST_PROMPT.count("[DOCUMENT_REQUEST:") == 1
    assert "]" in DOCUMENT_REQUEST_PROMPT.split("[DOCUMENT_REQUEST:")[1]


# ── Cross-repo contract ──────────────────────────────────────────────────────

def _registry_kinds() -> set[str]:
    source = REGISTRY_TS.read_text(encoding="utf-8")
    body = source[source.index("DOCUMENT_KINDS"):]
    return set(re.findall(r"^  (\w+): \{", body, re.M))


@pytest.mark.skipif(not REGISTRY_TS.exists(), reason="frontend not present")
def test_every_id_the_prompt_teaches_is_one_the_ui_knows():
    """
    An id the registry has never heard of still renders — the UI treats the
    catalogue as a fallback, not a gate. But an id we *teach* should be one with
    a proper label and icon, so a typo here is worth catching.
    """
    listed = set(re.findall(r"\b([a-z]+(?:_[a-z]+)+)\b", DOCUMENT_REQUEST_PROMPT))
    known = _registry_kinds()

    unknown = listed - known - {"document_request"}
    assert not unknown, f"prompt names ids the registry does not define: {sorted(unknown)}"


@pytest.mark.skipif(not REGISTRY_TS.exists(), reason="frontend not present")
def test_the_example_kind_is_a_real_one():
    for entry in _example_payload()["documents"]:
        assert entry["kind"] in _registry_kinds()


# ── House style ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "word", ["governance", "compliance", "mandate", "framework", "protocol"]
)
def test_the_block_avoids_the_forbidden_vocabulary(word):
    """The agent prompts ban these words; a block appended to every prompt must
    not smuggle them back in where the model can echo them."""
    assert word not in DOCUMENT_REQUEST_PROMPT.lower()


def test_the_customer_is_told_a_phone_photo_is_enough():
    """Most customers have no scanner — the block must say so, because that is
    the difference between an upload happening and the flow stalling."""
    assert "photo" in DOCUMENT_REQUEST_PROMPT.lower()


def test_the_agent_is_told_to_keep_the_tag_invisible():
    lowered = DOCUMENT_REQUEST_PROMPT.lower()
    assert "never mention the tag" in lowered
