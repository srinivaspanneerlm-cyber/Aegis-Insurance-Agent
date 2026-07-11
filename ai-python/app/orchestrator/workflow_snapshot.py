"""
Aegis AI — Workflow Snapshot Store

Captures and restores per-session per-domain workflow state when the user
switches insurance categories mid-consultation.

Snapshot contains:
  • domain        — the agent whose workflow was paused
  • stage         — workflow stage at the time of pause
  • history_tail  — last 6 messages for context injection on resume
  • profile_data  — customer data collected up to the pause point
  • rec_data      — recommendation card if one was generated
  • timestamp     — ISO timestamp of when the snapshot was taken

Storage: in-memory OrderedDict, keyed by session_id → domain.
Max 5 domains per session (evicts oldest on overflow).
"""

from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.utils.logger import logger


@dataclass
class WorkflowSnapshot:
    domain: str
    stage: str
    history_tail: List[Dict[str, Any]]
    profile_data: Dict[str, Any]
    rec_data: Optional[Dict[str, Any]]
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain":       self.domain,
            "stage":        self.stage,
            "history_tail": self.history_tail,
            "profile_data": self.profile_data,
            "rec_data":     self.rec_data,
            "timestamp":    self.timestamp,
        }

    @property
    def age_seconds(self) -> float:
        try:
            ts = datetime.fromisoformat(self.timestamp)
            return (datetime.utcnow() - ts).total_seconds()
        except Exception:
            return 0.0


class WorkflowSnapshotStore:
    """
    Bounded per-session workflow state store.

    Allows paused workflow state to be:
      • saved  before an agent switch (interrupt detected)
      • loaded when the user returns to a previous agent
      • cleared after a session ends

    Usage:
        store.save(session_id, domain, stage, history, profile, rec)
        snapshot = store.load(session_id, domain)
        if snapshot:
            # inject into new agent context
    """

    MAX_DOMAINS_PER_SESSION = 5

    def __init__(self) -> None:
        # { session_id: OrderedDict{ domain: WorkflowSnapshot } }
        self._store: Dict[str, OrderedDict] = {}

    # ── Public API ─────────────────────────────────────────────────────────────

    def save(
        self,
        session_id: str,
        domain: str,
        stage: str,
        history: List[Dict[str, Any]],
        profile_data: Dict[str, Any],
        rec_data: Optional[Dict[str, Any]] = None,
    ) -> WorkflowSnapshot:
        """
        Persists the current workflow state for session+domain.
        Overwrites any previous snapshot for the same domain.
        Evicts the oldest domain entry when the per-session limit is reached.
        """
        if session_id not in self._store:
            self._store[session_id] = OrderedDict()

        domain_map: OrderedDict = self._store[session_id]

        # Evict oldest if at cap (and new domain)
        if domain not in domain_map and len(domain_map) >= self.MAX_DOMAINS_PER_SESSION:
            evicted_key, _ = domain_map.popitem(last=False)
            logger.debug(
                f"[SnapshotStore] Evicted snapshot domain={evicted_key} "
                f"for session {session_id[:8]}"
            )

        snapshot = WorkflowSnapshot(
            domain=domain,
            stage=stage,
            history_tail=history[-6:] if history else [],
            profile_data=dict(profile_data),
            rec_data=dict(rec_data) if rec_data else None,
        )
        domain_map[domain] = snapshot
        domain_map.move_to_end(domain)

        logger.info(
            f"[SnapshotStore] SAVED  session={session_id[:8]}  domain={domain}  "
            f"stage={stage}  profile_fields={len(profile_data)}  "
            f"has_rec={snapshot.rec_data is not None}"
        )
        return snapshot

    def load(self, session_id: str, domain: str) -> Optional[WorkflowSnapshot]:
        """
        Returns the saved snapshot for this session+domain pair.
        Returns None if no snapshot exists.
        """
        snapshot = self._store.get(session_id, {}).get(domain)
        if snapshot:
            logger.info(
                f"[SnapshotStore] LOADED session={session_id[:8]}  domain={domain}  "
                f"stage={snapshot.stage}  age={snapshot.age_seconds:.0f}s"
            )
        return snapshot

    def has_snapshot(self, session_id: str, domain: str) -> bool:
        return domain in self._store.get(session_id, {})

    def list_domains(self, session_id: str) -> List[str]:
        """Returns all domains for which snapshots exist in this session."""
        return list(self._store.get(session_id, {}).keys())

    def clear(self, session_id: str, domain: Optional[str] = None) -> None:
        """Clears snapshot(s) for a session. If domain is None, clears all."""
        if domain:
            self._store.get(session_id, {}).pop(domain, None)
            logger.debug(f"[SnapshotStore] Cleared domain={domain} for session {session_id[:8]}")
        else:
            self._store.pop(session_id, None)
            logger.debug(f"[SnapshotStore] Cleared all snapshots for session {session_id[:8]}")
