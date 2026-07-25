"""
Aegis AI — Persistent Conversation Store

Saves and loads full conversation history to/from disk per customer per domain.
Survives: server restarts, session ID changes, page navigation, agent transfers.

Storage: Aegis-AI/layer3/conversation_memory/sessions/{customer_id}_{domain}.json

Each file:
  {
    "customer_id": "cust_sri",
    "domain": "health",
    "turns": [
      {"role": "user", "content": "...", "ts": "ISO"},
      {"role": "assistant", "content": "...", "ts": "ISO"},
      ...
    ],
    "last_updated": "ISO"
  }

Key decisions:
  - Keyed by (customer_id, domain), NOT session_id → survives session resets
  - Max 50 user+assistant pairs (100 entries) stored per customer per domain
  - In-memory cache layer to avoid repeated disk reads within a request
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.utils.atomic_io import atomic_write_text, file_lock, file_sig
from app.utils.logger import logger
from app.utils.metrics import timed_memory_op


class ConversationStore:
    """
    Persistent conversation history per (customer_id, domain).

    Lifecycle:
      1. On each request → load_history() → merge into agent's context
      2. After each response → save_turn() → append to disk
      3. On transfer → export_for_transfer() → pass last N turns to new agent

    This fixes:
      ✓ Problem 1: Every message treated as new
      ✓ Problem 5: Agent forgets previous questions
      ✓ Problem 6: Conversation history ignored
      ✓ Problem 7: Agent repeats same questions
      ✓ Problem 9: Details disappear after page navigation
      ✓ Problem 10: Transferred conversations lose context
    """

    MAX_TURNS = 50          # user+assistant pair max per customer per domain
    TRANSFER_EXPORT_TURNS = 10  # turns to export for cross-domain context

    def __init__(self, storage_dir: Path):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        # In-memory cache: "customer_id:domain" → list of turn dicts
        self._cache: Dict[str, List[Dict]] = {}

    # ── File path ─────────────────────────────────────────────────────────────

    def _path(self, customer_id: str, domain: str) -> Path:
        safe = f"{customer_id}_{domain}".replace("/", "_").replace("\\", "_")
        return self.storage_dir / f"{safe}.json"

    def _cache_key(self, customer_id: str, domain: str) -> str:
        return f"{customer_id}:{domain}"

    # ── Load ──────────────────────────────────────────────────────────────────

    @timed_memory_op("conversation_load")
    def load_history(self, customer_id: str, domain: str) -> List[Dict]:
        """
        Returns list of {role, content} dicts (no timestamps) for LLM context.
        The cache is mtime-aware (8.3b): cached turns are reused only while the
        file is unchanged, so another worker's appended turns are seen on the next
        read rather than masked by a stale cache.
        """
        key = self._cache_key(customer_id, domain)
        path = self._path(customer_id, domain)
        mtime = file_sig(path)
        cached = self._cache.get(key)
        if cached is not None and mtime is not None and cached[0] == mtime:
            return [{"role": t["role"], "content": t["content"]} for t in cached[1]]

        if not path.exists():
            return []

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            turns = data.get("turns", [])
            self._cache[key] = (mtime, turns)
            return [{"role": t["role"], "content": t["content"]} for t in turns]
        except Exception as e:
            logger.warning(f"[ConversationStore] Load failed for {customer_id}/{domain}: {e}")
            return []

    # ── Save ──────────────────────────────────────────────────────────────────

    @timed_memory_op("conversation_save_turn")
    def save_turn(
        self,
        customer_id: str,
        domain: str,
        user_message: str,
        assistant_message: str,
    ) -> None:
        """
        Append a user+assistant pair to disk. Thread-safe enough for single-server use.
        Skips saving empty assistant messages (e.g. error states).
        """
        if not user_message or not assistant_message:
            return

        path = self._path(customer_id, domain)
        key = self._cache_key(customer_id, domain)

        now = datetime.utcnow().isoformat()
        new_turns = [
            {"role": "user",      "content": user_message,      "ts": now},
            {"role": "assistant", "content": assistant_message, "ts": now},
        ]

        # Serialise the read-modify-write across workers and base the append on
        # the current on-disk state — not this process's cache — so a concurrent
        # worker's turns can never be overwritten, and the write is atomic. (8.3a)
        with file_lock(path):
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    turns = data.get("turns", [])
                except Exception as e:
                    logger.warning(f"[ConversationStore] Corrupt history for {customer_id}/{domain}, resetting: {e}")
                    data = {"customer_id": customer_id, "domain": domain, "turns": []}
                    turns = []
            else:
                data = {"customer_id": customer_id, "domain": domain, "turns": []}
                turns = []

            turns = turns + new_turns

            # Trim to max (each pair = 2 entries → MAX_TURNS pairs = MAX_TURNS*2 entries)
            if len(turns) > self.MAX_TURNS * 2:
                turns = turns[-(self.MAX_TURNS * 2):]

            data["turns"] = turns
            data["last_updated"] = now

            try:
                atomic_write_text(path, json.dumps(data, indent=2, ensure_ascii=False))
            except Exception as e:
                logger.error(f"[ConversationStore] Save failed for {customer_id}/{domain}: {e}")

        self._cache[key] = (file_sig(path), turns)

    # ── Transfer export ────────────────────────────────────────────────────────

    def export_for_transfer(
        self, customer_id: str, domain: str, max_turns: int = None
    ) -> List[Dict]:
        """
        Return the last N user+assistant pairs for context transfer to a new agent.
        Called by the orchestrator's transfer protocol.
        """
        n = max_turns or self.TRANSFER_EXPORT_TURNS
        path = self._path(customer_id, domain)
        if not path.exists():
            return []

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            turns = data.get("turns", [])[-n * 2:]
            return [{"role": t["role"], "content": t["content"]} for t in turns]
        except Exception as e:
            logger.warning(f"[ConversationStore] History read failed for {customer_id}/{domain}: {e}")
            return []

    # ── Questions asked (for repeat-detection) ─────────────────────────────────

    def get_questions_asked(self, customer_id: str, domain: str) -> List[str]:
        """
        Return all questions the agent asked the customer.
        Used to prevent asking the same question twice.
        """
        path = self._path(customer_id, domain)
        if not path.exists():
            return []

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            questions = []
            for turn in data.get("turns", []):
                if turn.get("role") == "assistant":
                    for part in turn.get("content", "").split("?"):
                        part = part.strip()
                        if len(part) > 15:
                            questions.append(part + "?")
            return questions
        except Exception as e:
            logger.warning(f"[ConversationStore] Questions read failed for {customer_id}/{domain}: {e}")
            return []

    # ── Conversation summary (for workflow context prompt) ─────────────────────

    def get_summary_context(self, customer_id: str, domain: str, max_turns: int = 6) -> str:
        """
        Returns the last N turns as a formatted text block for the system prompt.
        Helps the LLM recall what was discussed even when full history isn't passed.
        """
        history = self.load_history(customer_id, domain)
        if not history:
            return ""

        recent = history[-max_turns * 2:]
        lines = []
        for turn in recent:
            role = "Customer" if turn["role"] == "user" else "Advisor"
            content = turn["content"][:200].strip()
            if content:
                lines.append(f"{role}: {content}")

        if not lines:
            return ""

        return "=== RECENT CONVERSATION ===\n" + "\n".join(lines) + "\n"

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_turn_count(self, customer_id: str, domain: str) -> int:
        """Number of user messages stored for this customer+domain."""
        path = self._path(customer_id, domain)
        if not path.exists():
            return 0
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return sum(1 for t in data.get("turns", []) if t.get("role") == "user")
        except Exception as e:
            logger.warning(f"[ConversationStore] Turn-count read failed for {customer_id}/{domain}: {e}")
            return 0

    def clear_cache(self, customer_id: str, domain: str) -> None:
        self._cache.pop(self._cache_key(customer_id, domain), None)

    def clear_all(self, customer_id: str, domain: str) -> None:
        path = self._path(customer_id, domain)
        if path.exists():
            path.unlink()
        self.clear_cache(customer_id, domain)
