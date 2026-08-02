"""
Teaching every agent to ask for a document the way the UI can act on.

The advisor UI already turns an agent's plain-language request into upload cards
by reading the prose, which works but is guesswork: it cannot tell "send me your
RC book" from "I sent the RC book to underwriting". This block lets an agent say
exactly what it needs instead of being interpreted.

Nothing here changes what an agent decides — only how it writes the ask down.
The tag is optional: an agent that never emits one still works, because prose
inference stays as the fallback.

The `kind` ids mirror `frontend/src/lib/documents/registry.ts`. They are a
convenience, not a gate — an unknown kind still renders a usable upload card, so
an agent is free to ask for something the catalogue has never heard of.
"""

# Word choice matters: the agent prompts forbid "governance", "compliance",
# "mandate", "framework" and "protocol", so none of them appear below.
DOCUMENT_REQUEST_PROMPT = """
=== ASKING FOR A DOCUMENT ===
When you genuinely need the customer to send a file, write your normal warm reply
first, then put ONE tag on the last line:

[DOCUMENT_REQUEST:{"title":"Documents needed","documents":[{"kind":"rc_book","label":"RC Book","hint":"Front page is enough"}]}]

• Only when you actually need a file. Never on an ordinary question.
• Never mention the tag, never read it aloud, never explain it. The customer
  only sees your words — the tag becomes upload buttons for them.
• "kind": short lowercase id. Use one below if it fits; if what you need is not
  listed, make up a sensible id — it still works.
• "label": what the customer reads. Plain words, no jargon.
• Add "required": false for anything optional.
• Ask for the fewest documents that actually move things forward.
• Tell them a clear phone photo is fine — most customers have no scanner.

Ids you can use:
• Motor — rc_book, driving_license, vehicle_photos, previous_policy
• Health — medical_report, prescription, hospital_bill
• Travel — passport, visa, boarding_pass
• Property — sale_deed, property_photos, tax_receipt
• Anyone — aadhaar, pan_card, address_proof
"""


def get_document_request_prompt() -> str:
    """The document-request block appended to every agent's system prompt."""
    return DOCUMENT_REQUEST_PROMPT
