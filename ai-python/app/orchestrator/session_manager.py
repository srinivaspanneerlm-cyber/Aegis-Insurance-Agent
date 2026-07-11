"""
Aegis AI — Session Manager
Maintains per-session agent assignment, shared context, and transfer history.
Sessions survive domain transfers without greeting resets.
Supports snapshot/restore for user-controlled agent switching.
"""
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
from app.utils.logger import logger


class SessionManager:
    """
    In-memory session store keyed by session_id.
    Each session tracks:
      - active_agent: which agent is currently handling this session
      - previous_agent: the agent before the most recent user-approved transfer
      - context: shared customer profile snapshot
      - transfer_history: list of all agent transfers in this session
      - snapshot: saved state for "return to previous advisor"
      - created_at / last_active: for TTL management
    """

    SESSION_TTL_HOURS = 6

    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}

    # ── Session lifecycle ─────────────────────────────────────────────────────

    def _ensure(self, session_id: str, agent_key: Optional[str] = None) -> Dict[str, Any]:
        """Get or create a session entry."""
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "active_agent": agent_key or "",
                "previous_agent": None,
                "context": {},
                "transfer_history": [],
                "snapshot": None,
                # Workflow tracking (used by Intent Detection Engine gate)
                "workflow_status": "new",    # "new" | "active" | "completed" | "cancelled"
                "workflow_stage": "initial", # "initial" | "consultation" | "recommendation" | …
                # Intent detection audit trail
                "intent_history": [],        # list of IntentResult.to_dict() for this session
                "last_intent": None,         # most recent IntentResult.to_dict()
                "created_at": datetime.utcnow().isoformat(),
                "last_active": datetime.utcnow().isoformat(),
            }
        return self._sessions[session_id]

    def get_active_agent(self, session_id: str) -> Optional[str]:
        session = self._sessions.get(session_id)
        return session.get("active_agent") if session else None

    def set_active_agent(
        self,
        session_id: str,
        agent_key: str,
        context: Optional[Dict] = None,
        reason: Optional[str] = None,
    ) -> None:
        session = self._ensure(session_id, agent_key)
        prev = session.get("active_agent")
        if prev and prev != agent_key:
            session["previous_agent"] = prev
            session["transfer_history"].append({
                "from": prev,
                "to": agent_key,
                "reason": reason or "user_approved",
                "at": datetime.utcnow().isoformat(),
            })
        session["active_agent"] = agent_key
        session["last_active"] = datetime.utcnow().isoformat()
        if context:
            session["context"].update(context)

    # ── Snapshot / restore for "return to previous advisor" ──────────────────

    def save_snapshot(self, session_id: str) -> None:
        """Save a snapshot of the current session state before a forced transfer."""
        session = self._ensure(session_id)
        session["snapshot"] = {
            "active_agent": session.get("active_agent"),
            "context": dict(session.get("context", {})),
            "at": datetime.utcnow().isoformat(),
        }
        logger.info(
            f"[SessionManager] Snapshot saved for session {session_id[:8]}: "
            f"agent={session['snapshot']['active_agent']}"
        )

    def get_previous_agent(self, session_id: str) -> Optional[str]:
        """Returns the agent key from the last snapshot (= agent before last transfer)."""
        session = self._sessions.get(session_id)
        if not session:
            return None
        snapshot = session.get("snapshot")
        return snapshot.get("active_agent") if snapshot else session.get("previous_agent")

    def restore_snapshot(self, session_id: str) -> Optional[str]:
        """
        Restore the session to the snapshot state.
        Returns the restored agent key, or None if no snapshot exists.
        """
        session = self._sessions.get(session_id)
        if not session or not session.get("snapshot"):
            return None
        prev_agent = session["snapshot"].get("active_agent")
        if prev_agent:
            self.set_active_agent(session_id, prev_agent, reason="user_returned")
            session["snapshot"] = None
            logger.info(
                f"[SessionManager] Snapshot restored for session {session_id[:8]}: "
                f"returned to agent={prev_agent}"
            )
        return prev_agent

    # ── Workflow status ───────────────────────────────────────────────────────

    def get_workflow_status(self, session_id: str) -> str:
        """Returns workflow_status: 'new' | 'active' | 'completed' | 'cancelled'."""
        session = self._sessions.get(session_id)
        return session.get("workflow_status", "new") if session else "new"

    def set_workflow_status(self, session_id: str, status: str) -> None:
        """Update the workflow lifecycle state for a session."""
        session = self._ensure(session_id)
        session["workflow_status"] = status
        session["last_active"] = datetime.utcnow().isoformat()

    def get_workflow_stage(self, session_id: str) -> str:
        """Returns workflow_stage: 'initial' | 'consultation' | 'recommendation' | …"""
        session = self._sessions.get(session_id)
        return session.get("workflow_stage", "initial") if session else "initial"

    def set_workflow_stage(self, session_id: str, stage: str) -> None:
        """Update the workflow stage for a session."""
        session = self._ensure(session_id)
        session["workflow_stage"] = stage
        session["last_active"] = datetime.utcnow().isoformat()

    # ── Intent tracking ───────────────────────────────────────────────────────

    def record_intent(self, session_id: str, intent_dict: Dict[str, Any]) -> None:
        """
        Stores the IntentResult for auditing and multi-turn awareness.
        Keeps the last 10 intents per session.
        """
        session = self._ensure(session_id)
        history = session.setdefault("intent_history", [])
        history.append(intent_dict)
        if len(history) > 10:
            session["intent_history"] = history[-10:]
        session["last_intent"] = intent_dict
        session["last_active"] = datetime.utcnow().isoformat()

    def get_last_intent(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Returns the most recent IntentResult dict for this session."""
        session = self._sessions.get(session_id)
        return session.get("last_intent") if session else None

    def get_intent_history(self, session_id: str) -> list:
        """Returns all recorded IntentResults for this session."""
        session = self._sessions.get(session_id)
        return list(session.get("intent_history", [])) if session else []

    # ── Context ───────────────────────────────────────────────────────────────

    def get_context(self, session_id: str) -> Dict[str, Any]:
        session = self._sessions.get(session_id)
        return dict(session.get("context", {})) if session else {}

    def update_context(self, session_id: str, context: Dict[str, Any]) -> None:
        session = self._ensure(session_id)
        session["context"].update(context)
        session["last_active"] = datetime.utcnow().isoformat()

    def get_transfer_history(self, session_id: str):
        session = self._sessions.get(session_id)
        return list(session.get("transfer_history", [])) if session else []

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        logger.info(f"[SessionManager] Session {session_id} cleared")

    # ── Environment context persistence ───────────────────────────────────────

    def store_environment_context(self, session_id: str, domain: str, context: dict) -> None:
        """Stores exported environment context keyed by domain for later retrieval."""
        session = self._ensure(session_id)
        if "environment_contexts" not in session:
            session["environment_contexts"] = {}
        session["environment_contexts"][domain] = context
        session["last_active"] = datetime.utcnow().isoformat()
        logger.info(
            f"[SessionManager] Stored env context for session {session_id[:8]}, domain={domain}"
        )

    def get_environment_context(self, session_id: str, domain: str) -> Optional[dict]:
        """Retrieves stored environment context for a given domain."""
        session = self._sessions.get(session_id)
        if not session:
            return None
        env_contexts = session.get("environment_contexts", {})
        return env_contexts.get(domain)

    def get_full_session_snapshot(self, session_id: str) -> dict:
        """Returns the complete session state for diagnostics and debugging."""
        session = self._sessions.get(session_id)
        if not session:
            return {"session_id": session_id, "status": "not_found"}
        return {
            "session_id": session_id,
            "active_agent": session.get("active_agent"),
            "previous_agent": session.get("previous_agent"),
            "context": dict(session.get("context", {})),
            "transfer_history": list(session.get("transfer_history", [])),
            "snapshot": session.get("snapshot"),
            "environment_contexts": {
                domain: {"exported_at": ctx.get("exported_at"), "source_domain": ctx.get("source_domain")}
                for domain, ctx in session.get("environment_contexts", {}).items()
            },
            "created_at": session.get("created_at"),
            "last_active": session.get("last_active"),
        }

    # ── TTL pruning ───────────────────────────────────────────────────────────

    def prune_stale(self) -> int:
        cutoff = datetime.utcnow() - timedelta(hours=self.SESSION_TTL_HOURS)
        stale = [
            sid for sid, data in self._sessions.items()
            if datetime.fromisoformat(data.get("last_active", "2000-01-01")) < cutoff
        ]
        for sid in stale:
            del self._sessions[sid]
        if stale:
            logger.info(f"[SessionManager] Pruned {len(stale)} stale sessions")
        return len(stale)

    @property
    def active_count(self) -> int:
        return len(self._sessions)
