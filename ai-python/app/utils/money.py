"""
Reading a rupee amount out of whatever a customer actually typed.

Profile answers are stored as written. A pipeline question is answered in the
customer's own words, and when no extraction heuristic claims the reply the
whole sentence is filed against the step it answers — so `budget` holds
"10k sure" or "around 2000/month", not a number. Anything that then wants
arithmetic has to read the figure back out, and `float()` cannot: it raised on
the first free-text budget and took the entire turn down with it.

This is the number-reading half only. What a figure *means* — monthly or
annual, per person or per trip — is domain knowledge and stays in each
engine, which is why this returns a plain amount and converts nothing.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# Longest spelling first within each magnitude, and the single letters last, so
# "1 crore" is never read as the "cr" of something else. The trailing guard
# stops a plain number that happens to precede a word ("2000 kelvi") from being
# multiplied by that word's first letter.
_MAGNITUDES = (
    (r"crores?|cr",      10_000_000),
    (r"lakhs?|lacs?|l",     100_000),
    (r"thousand|k",           1_000),
)

_SUFFIXED = tuple(
    (re.compile(rf"(\d+(?:\.\d+)?)\s*(?:{unit})(?![a-z])"), multiplier)
    for unit, multiplier in _MAGNITUDES
)

_PLAIN = re.compile(r"\d+(?:\.\d+)?")


def parse_amount(raw: Any) -> Optional[float]:
    """Return the rupee figure `raw` carries, or None if it carries no number.

    Understands the magnitudes Indian customers write — k, thousand, lakh/lac,
    crore — and the punctuation they write them with. Never raises: unreadable
    input is a None to be handled, not an exception to escape into a reply.
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw)

    text = str(raw).lower().replace(",", "")
    for pattern, multiplier in _SUFFIXED:
        match = pattern.search(text)
        if match:
            return float(match.group(1)) * multiplier

    match = _PLAIN.search(text)
    return float(match.group(0)) if match else None
