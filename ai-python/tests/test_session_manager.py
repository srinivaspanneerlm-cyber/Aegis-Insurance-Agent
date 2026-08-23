"""
SessionManager — stale-session pruning and reused-session_id isolation.

Had no dedicated test file before this one, despite CLAUDE.md's "no
stale-session leakage" requirement and the class's own docstring naming a
6-hour TTL. Pure in-memory, no LLM, no disk — safe to drive directly.

Known gap this file does NOT close, and flags instead: `prune_stale()` is
never called anywhere outside this class (confirmed by repo-wide grep) — no
scheduler, no call from `CentralOrchestrator.dispatch`, nothing on FastAPI
startup. The TTL is real code but is not currently wired to run. Fixing that
is a lifecycle/wiring decision (where to call it from, how often) rather than
a test gap, so it is reported, not fixed here.
"""
from datetime import datetime, timedelta

import pytest

from app.orchestrator.session_manager import SessionManager


@pytest.fixture
def mgr():
    return SessionManager()


def _age_session(mgr, session_id, hours_ago):
    """Backdate a session's last_active, as if it had gone quiet `hours_ago`."""
    session = mgr._sessions[session_id]
    session["last_active"] = (datetime.utcnow() - timedelta(hours=hours_ago)).isoformat()


# ── Pruning itself ──────────────────────────────────────────────────────────────

def test_a_session_younger_than_the_ttl_survives_pruning(mgr):
    mgr.set_active_agent("fresh-session", "health")
    _age_session(mgr, "fresh-session", hours_ago=1)

    pruned = mgr.prune_stale()

    assert pruned == 0
    assert mgr.get_active_agent("fresh-session") == "health"


def test_a_session_older_than_the_ttl_is_pruned(mgr):
    mgr.set_active_agent("stale-session", "motor")
    _age_session(mgr, "stale-session", hours_ago=SessionManager.SESSION_TTL_HOURS + 1)

    pruned = mgr.prune_stale()

    assert pruned == 1
    assert mgr.get_active_agent("stale-session") is None
    assert mgr.get_workflow_status("stale-session") == "new"  # looks unseen, not corrupted


def test_pruning_only_removes_the_sessions_past_the_ttl(mgr):
    mgr.set_active_agent("keep-me", "health")
    _age_session(mgr, "keep-me", hours_ago=1)
    mgr.set_active_agent("prune-me", "motor")
    _age_session(mgr, "prune-me", hours_ago=SessionManager.SESSION_TTL_HOURS + 1)

    pruned = mgr.prune_stale()

    assert pruned == 1
    assert mgr.get_active_agent("keep-me") == "health"
    assert mgr.get_active_agent("prune-me") is None


# ── No leakage into a reused session_id ──────────────────────────────────────────

def test_a_pruned_and_reused_session_id_starts_completely_clean(mgr):
    """A stale session's declined_domains/workflow state must not leak forward
    if the same session_id is (re)used later — e.g. a client that cached an old
    id, or a UUID collision in principle."""
    session_id = "reused-session-id"

    mgr.set_active_agent(session_id, "motor", reason="user_approved")
    mgr.set_workflow_status(session_id, "completed")
    mgr.set_workflow_stage(session_id, "recommendation")
    mgr.record_intent(session_id, {"intent": "compare", "confidence": 0.9})
    _age_session(mgr, session_id, hours_ago=SessionManager.SESSION_TTL_HOURS + 1)

    pruned = mgr.prune_stale()
    assert pruned == 1

    # Same session_id, treated as brand new.
    assert mgr.get_active_agent(session_id) is None
    assert mgr.get_workflow_status(session_id) == "new"
    assert mgr.get_workflow_stage(session_id) == "initial"
    assert mgr.get_last_intent(session_id) is None
    assert mgr.get_intent_history(session_id) == []
    assert mgr.get_transfer_history(session_id) == []


def test_active_count_reflects_pruning(mgr):
    mgr.set_active_agent("a", "health")
    mgr.set_active_agent("b", "motor")
    _age_session(mgr, "b", hours_ago=SessionManager.SESSION_TTL_HOURS + 1)

    assert mgr.active_count == 2
    mgr.prune_stale()
    assert mgr.active_count == 1
