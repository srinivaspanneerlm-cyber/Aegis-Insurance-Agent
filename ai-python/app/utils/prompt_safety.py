"""
Making customer-supplied values safe to put in a prompt.

Profile fields are rendered into the agent's system prompt, and every one of
them started as something the customer typed. Without treatment, an answer to
"any pre-existing conditions?" lands inside the instructions the model is
following — on that turn, on every later turn, and (for shared fields) in every
other advisor's prompt too.

What actually carries the attack is structure, not vocabulary: a newline lets a
value open a block of its own, and length is what turns a stray sentence into a
wall of instructions. So the defence is to flatten and bound, not to guess at
malicious phrases — a blocklist of "ignore previous instructions" is trivially
reworded, while a value that cannot leave its line has nowhere to say it.

Deliberately NOT an alphabetic allow-list. Our customers write their names in
Tamil, and answer in Tamil, English, and a mix of both; an `[A-Za-z]` filter
would corrupt exactly the people this product exists for. Unicode letters pass
through untouched. What gets removed is what no human types and only a machine
reads: control characters, zero-width and bidi overrides, and the angle
brackets that would let a value forge the delimiter around it.

Applied in two places on purpose — when a value is extracted, so nothing new is
stored raw, and again when a profile is rendered, because profiles written
before this existed are still on disk and still get loaded.
"""
import re
from typing import Any, Dict

# Control characters, including the newlines and tabs that give a value shape.
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f-\x9f]")

# Invisible to the customer and to anyone reviewing the profile; not invisible
# to the model. Zero-width joiners/spaces, bidi overrides, word joiners, BOM.
_INVISIBLE_CHARS = re.compile(r"[​-‏‪-‮⁠-⁤﻿]")

# Angle brackets are stripped so a value can never close or forge the block it
# is rendered inside. Nothing a customer legitimately answers needs them.
_DELIMITER_CHARS = re.compile(r"[<>]")

_WHITESPACE_RUN = re.compile(r"\s+")

# Ceilings sized to the longest answer a real customer would give. A cap that is
# too tight silently truncates someone's genuine answer, so these are generous —
# the security win is that they are finite at all, not that they are small.
FIELD_MAX_LENGTH: Dict[str, int] = {
    "name": 80,
    "gender": 20,
    "occupation": 60,
    "location": 60,
    "language": 30,
    "communication_preference": 40,
    "nominee": 80,
    "annual_income": 40,
    "budget": 40,
    "medical_history": 300,
    "pre_existing_conditions": 300,
    "preferred_hospitals": 120,
    "critical_illness_history": 300,
    "vehicle": 60,
    "registration_number": 20,
    "vehicle_type": 40,
    "previous_insurer": 60,
    "ncb_history": 40,
    "travel_plans": 200,
    "destination": 60,
    "trip_duration": 30,
    "travel_frequency": 40,
    "visa_type": 40,
    "property": 60,
    "property_type": 40,
    "property_value": 40,
    "construction_year": 10,
    "floor_number": 10,
    "tenants": 40,
    "company_name": 80,
    "company_size": 40,
    "industry": 60,
    "annual_turnover": 40,
    "employee_count": 20,
    "risk_profile": 40,
    "preferred_category": 40,
}

# Anything not named above still gets a bound; an unlisted field is an oversight,
# not a licence.
DEFAULT_MAX_LENGTH = 120

# A list field cannot be used to smuggle length past the per-item cap.
MAX_LIST_ITEMS = 20


def sanitize_profile_value(field: str, value: Any) -> Any:
    """
    Flatten and bound one profile value so it is inert inside a prompt.

    Non-strings are returned untouched: ages and budgets are produced by numeric
    parsers, so their type is already the constraint. Lists are sanitized
    item-wise and bounded in length.
    """
    if isinstance(value, list):
        return [sanitize_profile_value(field, v) for v in value[:MAX_LIST_ITEMS]]

    if not isinstance(value, str):
        return value

    cleaned = _CONTROL_CHARS.sub(" ", value)
    cleaned = _INVISIBLE_CHARS.sub("", cleaned)
    cleaned = _DELIMITER_CHARS.sub("", cleaned)
    cleaned = _WHITESPACE_RUN.sub(" ", cleaned).strip()

    limit = FIELD_MAX_LENGTH.get(field, DEFAULT_MAX_LENGTH)
    return cleaned[:limit].strip()


def sanitize_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize every value in a profile dict. Keys and shape are unchanged."""
    return {k: sanitize_profile_value(k, v) for k, v in profile.items()}
