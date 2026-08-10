"""
The key that isolates one customer's memory from every other customer's.

Every conversation turn, profile answer and cached recommendation is stored
under this id. Two independent call sites used to derive it themselves, both
from the customer's *display name* alone — normalized, but still just a name.
"Priya Kumar" and "priya kumar" and "Priya  Kumar" all resolve to the same
key, and so, more importantly, do two different real customers who happen to
share a name. That is not a hypothetical: it is the ordinary case on a
platform built for it. The result was that one customer could read the other's
prior conversation, their answered profile fields — medical history, income,
dependents — and their cached recommendation, because both were the same file
on disk.

The fix is the backend's own authenticated `user_id`, threaded through from
the session the way `user_name` already is. It is optional here rather than
required: the AI engine has callers (direct `/ai-chat` integration, tests)
that predate this field and will keep working, falling back to the old
name-based key exactly as before. A caller that supplies `user_id` gets
correct isolation; a caller that does not is no worse off than today.
"""
from typing import Optional


def derive_customer_id(
    user_name: Optional[str],
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> str:
    """
    The one place this key is computed. Both memory-persistence sites (agent
    environment's conversation history, and the agent's own profile /
    recommendation cache) call this rather than deriving it themselves, so a
    future change to the formula cannot land in one place and not the other.

    Priority: a stable user_id (once the caller has an authenticated
    identity) > the normalized display name (backward compatible) > an
    anonymous, session-scoped id (never persisted across sessions).
    """
    if user_id and user_id.strip():
        return f"cust_{user_id.strip()}"
    if user_name and user_name.strip():
        normalized = user_name.strip().lower().replace(" ", "_").replace(".", "_")
        return f"cust_{normalized}"
    if session_id:
        return f"anon_{session_id[:8]}"
    return "cust_default"
