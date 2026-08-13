"""
Agent Environment — Complete isolated runtime for a single Aegis AI specialist agent.
Provides: independent memory, session state, conversation history, response cache,
workflow state, diagnostics, logger, configuration, and temporary storage.

The ONLY inter-environment communication path is through the ExecutiveOrchestrator.
"""
import time
import hashlib
import json
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from app.utils.logger import logger as root_logger
from app.utils.customer_identity import derive_customer_id


# ── Dataclasses ────────────────────────────────────────────────────────────────

@dataclass
class WorkflowState:
    """Per-session workflow progress tracker."""
    stage: str = "initial"           # initial | consultation | recommendation | selection | purchase
    recommendation_id: Optional[str] = None
    selected_plan: Optional[str] = None
    purchase_progress: int = 0       # 0–100
    navigation_history: List[str] = field(default_factory=list)

    def advance(self, new_stage: str) -> None:
        valid_stages = ["initial", "consultation", "recommendation", "selection", "purchase"]
        if new_stage in valid_stages:
            self.navigation_history.append(self.stage)
            self.stage = new_stage


@dataclass
class EnvironmentDiagnostics:
    """Tracks performance and reliability metrics for a single environment."""
    total_requests: int = 0
    total_errors: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    total_response_time_ms: float = 0.0
    last_request_at: Optional[str] = None

    @property
    def avg_response_time_ms(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return round(self.total_response_time_ms / self.total_requests, 2)

    @property
    def error_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return round(self.total_errors / self.total_requests, 4)

    @property
    def cache_hit_rate(self) -> float:
        total_lookups = self.cache_hits + self.cache_misses
        if total_lookups == 0:
            return 0.0
        return round(self.cache_hits / total_lookups, 4)


@dataclass
class EnvironmentResult:
    """Structured result from AgentEnvironment.process()."""
    text: str
    agent_name: str
    agent_domain: str
    transferred: bool = False
    suggest_transfer: bool = False
    transfer_to: Optional[str] = None
    transfer_to_name: Optional[str] = None
    transfer_reason: Optional[str] = None
    previous_agent: Optional[str] = None
    session_id: str = ""
    env_metadata: Dict[str, Any] = field(default_factory=dict)


# ── Agent Environment ──────────────────────────────────────────────────────────

class AgentEnvironment:
    """
    A fully isolated runtime container for a single Aegis AI specialist agent.
    Each domain gets exactly one environment, booted at startup.
    """

    CACHE_TTL_DEFAULT = 120          # seconds
    CACHE_MAX_SIZE_DEFAULT = 100
    MAX_HISTORY_DEFAULT = 20

    def __init__(self, agent: Any, config: dict):
        self.agent = agent
        self.config = config
        # Push JSON config into agent so personality/topics are driven by the file
        if hasattr(agent, 'set_env_config'):
            agent.set_env_config(config)

        # Core identity
        self.domain: str = getattr(agent, "DOMAIN", config.get("domain", "unknown"))
        self.name: str = getattr(agent, "NAME", config.get("name", "Unknown Agent"))

        # Isolated config values
        self._cache_ttl: int = config.get("cache_ttl_seconds", self.CACHE_TTL_DEFAULT)
        self._cache_max: int = config.get("cache_max_size", self.CACHE_MAX_SIZE_DEFAULT)
        self._max_history: int = config.get("max_history_length", self.MAX_HISTORY_DEFAULT)

        # Isolated stores (per environment, never shared)
        self._cache: Dict[str, Dict[str, Any]] = {}          # cache_key → {value, created_at, ttl}
        self._cache_order: List[str] = []                     # LRU order (oldest first)
        self._history: Dict[str, List[Dict]] = {}             # session_id → in-memory message list
        self._workflows: Dict[str, WorkflowState] = {}        # session_id → WorkflowState
        self._session_meta: Dict[str, Dict[str, Any]] = {}    # session_id → metadata dict

        # Memory Orchestrator (from agent — provides persistent history + profile cache)
        self._memory_orch = getattr(agent, "_memory_orch", None)

        # Diagnostics
        self.diagnostics = EnvironmentDiagnostics()

        # Per-environment isolated logger
        self._log = logging.getLogger(f"aegis.env.{self.domain}")
        if not self._log.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(_EnvFormatter(self.domain))
            self._log.addHandler(handler)
            self._log.propagate = False
            self._log.setLevel(logging.INFO)

        root_logger.info(
            f"[ENV:{self.domain.upper()}] Environment booted — "
            f"agent={self.name}, cache_ttl={self._cache_ttl}s, "
            f"max_history={self._max_history}"
        )

    # ── Main entry point ────────────────────────────────────────────────────────

    async def process(
        self,
        message: str,
        session_id: str,
        user_name: str,
        history: Optional[List[Dict]] = None,
        user_id: Optional[str] = None,
    ) -> EnvironmentResult:
        """
        Full isolated request pipeline:
        1. Derive customer_id for persistent-history keying.
        2. Load persistent conversation history from disk (memory orchestrator).
        3. Merge persistent + caller-provided + env-local history.
        4. Check response cache.
        5. Call agent.respond() with full merged history.
        6. Update env-local history + save turn to persistent store.
        7. Advance workflow, cache result, return EnvironmentResult.
        """
        t_start = time.monotonic()
        self.diagnostics.total_requests += 1
        self.diagnostics.last_request_at = datetime.utcnow().isoformat()

        # ── Derive customer_id — same helper agent.generate_response() uses,
        # so the persistent-history key and the profile/recommendation key
        # can never drift apart. Prefers user_id when the caller has one.
        customer_id = derive_customer_id(user_name, user_id, session_id)

        # ── Ensure session meta and workflow ────────────────────────────────────
        if session_id not in self._session_meta:
            self._session_meta[session_id] = {
                "session_id": session_id,
                "domain": self.domain,
                "agent_name": self.name,
                "created_at": datetime.utcnow().isoformat(),
                "request_count": 0,
                "customer_id": customer_id,
            }
        self._session_meta[session_id]["request_count"] = (
            self._session_meta[session_id].get("request_count", 0) + 1
        )
        if session_id not in self._workflows:
            self._workflows[session_id] = WorkflowState()

        # ── Load persistent history from disk ────────────────────────────────────
        persistent_history: List[Dict] = []
        if self._memory_orch:
            try:
                persistent_history = self._memory_orch.load_history(customer_id, self.domain)
            except Exception as pe:
                self._log.warning(f"Persistent history load failed: {pe}")

        # ── Merge: persistent base + caller-provided + env-local ─────────────────
        merged_history = self._merge_history_full(
            session_id, history or [], persistent_history
        )

        # ── Cache lookup ─────────────────────────────────────────────────────────
        cache_key = self._make_cache_key(session_id, message)
        cached = self._cache_get(cache_key)
        if cached is not None:
            self.diagnostics.cache_hits += 1
            elapsed = (time.monotonic() - t_start) * 1000
            self.diagnostics.total_response_time_ms += elapsed
            self._log.info(f"Cache hit for session {session_id[:8]} — {elapsed:.1f}ms")
            return cached

        self.diagnostics.cache_misses += 1

        # ── Call agent ───────────────────────────────────────────────────────────
        try:
            agent_response = await self.agent.respond(
                message, merged_history, user_name, session_id, user_id=user_id
            )
        except Exception as exc:
            self.diagnostics.total_errors += 1
            self._log.error(f"agent.respond() failed for session {session_id[:8]}: {exc}")
            elapsed = (time.monotonic() - t_start) * 1000
            self.diagnostics.total_response_time_ms += elapsed
            return EnvironmentResult(
                text=self.agent._fallback_message(user_name),
                agent_name=self.name,
                agent_domain=self.domain,
                session_id=session_id,
                env_metadata={"error": str(exc), "response_time_ms": round(elapsed, 2)},
            )

        elapsed = (time.monotonic() - t_start) * 1000
        self.diagnostics.total_response_time_ms += elapsed

        # ── A turn the agent could not produce is not a turn ──────────────────────
        # It is shown to the customer once, as an apology, and then forgotten.
        # Keeping it did real damage: the text was written to disk, so it came
        # back in the customer's window on every reload and was replayed to the
        # model as something the advisor had said; and it was cached against
        # (session, message), so retyping the same thing returned the same
        # apology — long after the underlying bug was fixed. An apology is
        # never worth remembering, so nothing below remembers this one.
        if getattr(agent_response, "failed", False):
            self.diagnostics.total_errors += 1
            self._log.warning(
                f"Session {session_id[:8]} — agent could not answer; "
                f"turn not cached, not persisted, workflow not advanced"
            )
            return EnvironmentResult(
                text=agent_response.text,
                agent_name=agent_response.agent_name,
                agent_domain=agent_response.agent_domain,
                session_id=session_id,
                env_metadata={
                    "domain": self.domain,
                    "failed": True,
                    "response_time_ms": round(elapsed, 2),
                },
            )

        # ── Update env-local history ─────────────────────────────────────────────
        self._push_history(session_id, "user", message)
        self._push_history(session_id, "assistant", agent_response.text)

        # ── Save turn to persistent store (disk) ─────────────────────────────────
        if self._memory_orch and not agent_response.suggest_transfer:
            try:
                self._memory_orch.save_turn(
                    customer_id, self.domain, message, agent_response.text
                )
            except Exception as se:
                self._log.warning(f"Persistent history save failed: {se}")

        # ── Advance workflow stage ────────────────────────────────────────────────
        self._advance_workflow(session_id, message, agent_response.text)

        # ── Build result ─────────────────────────────────────────────────────────
        result = EnvironmentResult(
            text=agent_response.text,
            agent_name=agent_response.agent_name,
            agent_domain=agent_response.agent_domain,
            transferred=agent_response.transferred,
            suggest_transfer=agent_response.suggest_transfer,
            transfer_to=agent_response.transfer_to,
            transfer_to_name=agent_response.transfer_to_name,
            transfer_reason=agent_response.transfer_reason,
            session_id=session_id,
            env_metadata={
                "domain": self.domain,
                "response_time_ms": round(elapsed, 2),
                "workflow_stage": self._workflows[session_id].stage,
                "cache_hit_rate": self.diagnostics.cache_hit_rate,
                "request_count": self._session_meta[session_id]["request_count"],
                "customer_id": customer_id,
                "persistent_history_turns": len(persistent_history) // 2,
            },
        )

        # ── Cache result (only non-transfer, non-suggest responses) ─────────────
        if not result.suggest_transfer and not result.transferred:
            self._cache_put(cache_key, result)

        self._log.info(
            f"Processed session {session_id[:8]} — "
            f"customer={customer_id}, "
            f"stage={self._workflows[session_id].stage}, "
            f"hist_turns={len(persistent_history)//2}+{len(self._history.get(session_id,[]))//2}, "
            f"{elapsed:.1f}ms"
        )
        return result

    # ── Context export / import (transfer protocol) ────────────────────────────

    def export_session_context(self, session_id: str) -> dict:
        """
        Exports transferable context for this session.
        Called before a user-approved transfer to another environment.
        """
        history = self._history.get(session_id, [])
        workflow = self._workflows.get(session_id, WorkflowState())
        meta = self._session_meta.get(session_id, {})

        exported = {
            "source_domain": self.domain,
            "source_agent_name": self.name,
            "session_id": session_id,
            "exported_at": datetime.utcnow().isoformat(),
            "history": history[-10:],          # last 10 entries only
            "workflow": {
                "stage": workflow.stage,
                "recommendation_id": workflow.recommendation_id,
                "selected_plan": workflow.selected_plan,
                "purchase_progress": workflow.purchase_progress,
                "navigation_history": workflow.navigation_history,
            },
            "session_meta": {
                "created_at": meta.get("created_at"),
                "request_count": meta.get("request_count", 0),
            },
        }
        root_logger.info(
            f"[ENV:{self.domain.upper()}] Exported context for session {session_id[:8]} "
            f"({len(exported['history'])} history entries, stage={workflow.stage})"
        )
        return exported

    def import_session_context(self, session_id: str, context: dict) -> None:
        """
        Receives context from a previous environment after a user-approved transfer.
        Imports: conversation history + workflow state.
        Does NOT import memory — memory stays domain-isolated in each agent.
        """
        if not context:
            return

        # Import history (env-local only — agent memory stays isolated)
        incoming_history = context.get("history", [])
        if incoming_history:
            existing = self._history.get(session_id, [])
            # Append incoming (de-dup by checking last entries)
            merged = incoming_history + [
                e for e in existing
                if e not in incoming_history
            ]
            max_len = self._max_history * 2
            self._history[session_id] = merged[-max_len:]

        # Import workflow state
        wf_data = context.get("workflow", {})
        if wf_data:
            wf = self._workflows.get(session_id, WorkflowState())
            wf.stage = wf_data.get("stage", wf.stage)
            wf.recommendation_id = wf_data.get("recommendation_id", wf.recommendation_id)
            wf.selected_plan = wf_data.get("selected_plan", wf.selected_plan)
            wf.purchase_progress = wf_data.get("purchase_progress", wf.purchase_progress)
            # Extend navigation history to show the transfer trail
            src = context.get("source_domain", "unknown")
            if src not in wf.navigation_history:
                wf.navigation_history.append(src)
            self._workflows[session_id] = wf

        # Seed session meta if new to this env
        if session_id not in self._session_meta:
            src_meta = context.get("session_meta", {})
            self._session_meta[session_id] = {
                "session_id": session_id,
                "domain": self.domain,
                "agent_name": self.name,
                "created_at": src_meta.get("created_at", datetime.utcnow().isoformat()),
                "request_count": 0,
                "transferred_from": context.get("source_domain"),
            }

        root_logger.info(
            f"[ENV:{self.domain.upper()}] Imported context from "
            f"{context.get('source_domain', '?')} for session {session_id[:8]}"
        )

    # ── Health report ───────────────────────────────────────────────────────────

    def health_report(self) -> dict:
        return {
            "status": "active",
            "domain": self.domain,
            "agent_name": self.name,
            "diagnostics": {
                "total_requests": self.diagnostics.total_requests,
                "total_errors": self.diagnostics.total_errors,
                "cache_hits": self.diagnostics.cache_hits,
                "cache_misses": self.diagnostics.cache_misses,
                "avg_response_time_ms": self.diagnostics.avg_response_time_ms,
                "error_rate": self.diagnostics.error_rate,
                "cache_hit_rate": self.diagnostics.cache_hit_rate,
                "last_request_at": self.diagnostics.last_request_at,
            },
            "cache_size": len(self._cache),
            "cache_max_size": self._cache_max,
            "active_sessions": len(self._session_meta),
            "config": {
                "cache_ttl_seconds": self._cache_ttl,
                "max_history_length": self._max_history,
            },
        }

    # ── Internal helpers ────────────────────────────────────────────────────────

    def _make_cache_key(self, session_id: str, message: str) -> str:
        raw = f"{self.domain}:{session_id}:{message.lower().strip()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _cache_get(self, key: str) -> Optional[EnvironmentResult]:
        entry = self._cache.get(key)
        if not entry:
            return None
        if time.time() - entry["created_at"] > entry["ttl"]:
            # TTL expired — evict
            self._cache.pop(key, None)
            if key in self._cache_order:
                self._cache_order.remove(key)
            return None
        # Move to end (most recently used)
        if key in self._cache_order:
            self._cache_order.remove(key)
        self._cache_order.append(key)
        return entry["value"]

    def _cache_put(self, key: str, value: EnvironmentResult) -> None:
        # LRU eviction if at capacity
        while len(self._cache) >= self._cache_max and self._cache_order:
            oldest = self._cache_order.pop(0)
            self._cache.pop(oldest, None)

        self._cache[key] = {
            "value": value,
            "created_at": time.time(),
            "ttl": self._cache_ttl,
        }
        if key in self._cache_order:
            self._cache_order.remove(key)
        self._cache_order.append(key)

    def _merge_history(self, session_id: str, caller_history: List[Dict]) -> List[Dict]:
        """Legacy 2-source merge. Kept for backward compat with process_forced()."""
        return self._merge_history_full(session_id, caller_history, [])

    def _merge_history_full(
        self,
        session_id: str,
        caller_history: List[Dict],
        persistent_history: List[Dict],
    ) -> List[Dict]:
        """
        3-source merge for persistent-backed history.

        Priority order (highest → lowest):
          1. Env-local history (most recent, definitive for this session)
          2. Caller-provided history (from chat service)
          3. Persistent history (from disk — survives restarts)

        De-duplicated by (role, first-50-chars-of-content).
        Trimmed to max_history * 2 entries.
        """
        env_history = self._history.get(session_id, [])
        max_len = self._max_history * 2

        # Build seen set from env-local (highest priority)
        def turn_key(t: Dict) -> tuple:
            return (
                t.get("role", ""),
                (t.get("content") or t.get("message") or "")[:60],
            )

        seen = {turn_key(t) for t in env_history}

        # Add caller turns not already in env-local
        caller_new = [t for t in caller_history if turn_key(t) not in seen]
        for t in caller_new:
            seen.add(turn_key(t))

        # Add persistent turns not already covered
        persistent_new = [t for t in persistent_history if turn_key(t) not in seen]

        # Merge: persistent (oldest) → caller → env-local (newest)
        merged = persistent_new + caller_new + env_history
        return merged[-max_len:]

    def _push_history(self, session_id: str, role: str, content: str) -> None:
        if session_id not in self._history:
            self._history[session_id] = []
        self._history[session_id].append({"role": role, "content": content})
        # Trim
        max_len = self._max_history * 2
        if len(self._history[session_id]) > max_len:
            self._history[session_id] = self._history[session_id][-max_len:]

    # ── Forced process (user-approved transfer — bypasses domain check) ───────

    async def process_forced(
        self,
        message: str,
        session_id: str,
        user_name: str,
        history: Optional[List[Dict]] = None,
        user_id: Optional[str] = None,
    ) -> "EnvironmentResult":
        """
        Forced entry point — bypasses check_domain_violation entirely.
        Called exclusively by the ExecutiveOrchestrator after user explicitly approves
        a transfer. Context must be imported via import_session_context() BEFORE calling.
        """
        t_start = time.monotonic()
        self.diagnostics.total_requests += 1
        self.diagnostics.last_request_at = datetime.utcnow().isoformat()

        if session_id not in self._session_meta:
            self._session_meta[session_id] = {
                "session_id": session_id,
                "domain": self.domain,
                "agent_name": self.name,
                "created_at": datetime.utcnow().isoformat(),
                "request_count": 0,
            }
        self._session_meta[session_id]["request_count"] = (
            self._session_meta[session_id].get("request_count", 0) + 1
        )
        if session_id not in self._workflows:
            self._workflows[session_id] = WorkflowState()

        merged_history = self._merge_history(session_id, history or [])

        try:
            # Bypass check_domain_violation — call generate_response directly
            raw_reply = await self.agent.generate_response(
                message, merged_history, user_name, session_id, user_id=user_id
            )
            reply = self.agent._clean_response(raw_reply)
        except Exception as exc:
            self.diagnostics.total_errors += 1
            self._log.error(f"process_forced error: {exc}")
            elapsed_ms = (time.monotonic() - t_start) * 1000
            self.diagnostics.total_response_time_ms += elapsed_ms
            reply = self.agent._fallback_message(user_name)

        elapsed_ms = (time.monotonic() - t_start) * 1000
        self.diagnostics.total_response_time_ms += elapsed_ms

        self._push_history(session_id, "user", message)
        self._push_history(session_id, "assistant", reply)
        self._advance_workflow(session_id, message, reply)

        self._log.info(
            f"process_forced complete — session={session_id[:8]}, {elapsed_ms:.1f}ms"
        )

        return EnvironmentResult(
            text=reply,
            agent_name=self.name,
            agent_domain=self.domain,
            transferred=True,
            session_id=session_id,
            env_metadata={
                "forced_transfer": True,
                "response_time_ms": round(elapsed_ms, 1),
                "workflow_stage": self._workflows[session_id].stage,
            },
        )

    async def coordinate_transfer(
        self,
        from_key: str,
        from_name: str,
        to_key: str,
        to_name: str,
        user_message: str,
        user_name: str,
        session_id: str,
        history: Optional[List[Dict]] = None,
    ) -> "EnvironmentResult":
        """
        Executive AI coordinator: asks customer permission to connect to the right specialist.
        Called only on the Executive environment. Does not modify history/workflow.
        """
        t_start = time.monotonic()

        if hasattr(self.agent, 'route_as_coordinator'):
            try:
                text = await self.agent.route_as_coordinator(
                    from_key=from_key,
                    from_name=from_name,
                    to_key=to_key,
                    to_name=to_name,
                    user_message=user_message,
                    user_name=user_name,
                    history=history or [],
                )
            except Exception as e:
                self._log.error(f"route_as_coordinator error: {e}")
                detected_display = to_key.replace("-", " ").title()
                text = (
                    f"I can see your question is about **{detected_display} Insurance**. "
                    f"**{to_name}** is our specialist for this domain. "
                    f"Shall I connect you to {to_name}? "
                    "Your conversation history and profile will be preserved."
                )
        else:
            detected_display = to_key.replace("-", " ").title()
            text = (
                f"I can see your question is about **{detected_display} Insurance**. "
                f"**{to_name}** is our specialist for this domain. "
                f"Shall I connect you to {to_name}? "
                "Your conversation history and profile will be preserved."
            )

        elapsed_ms = (time.monotonic() - t_start) * 1000
        return EnvironmentResult(
            text=text,
            agent_name=self.name,
            agent_domain=self.domain,
            transferred=False,
            suggest_transfer=True,
            transfer_to=to_key,
            transfer_to_name=to_name,
            transfer_reason=f"domain mismatch: {from_key} → {to_key}",
            previous_agent=from_key,
            session_id=session_id,
            env_metadata={
                "coordinator_mode": True,
                "from_key": from_key,
                "to_key": to_key,
                "response_time_ms": round(elapsed_ms, 1),
            },
        )

    def _advance_workflow(self, session_id: str, message: str, reply: str) -> None:
        """
        Heuristically advance workflow stage based on reply content.
        This is lightweight — real stage control is via UI actions.
        """
        wf = self._workflows[session_id]
        msg_lower = message.lower()
        reply_lower = reply.lower()

        if wf.stage == "initial" and len(msg_lower) > 20:
            wf.advance("consultation")
        elif wf.stage == "consultation" and any(
            kw in reply_lower for kw in ["recommend", "suggest", "plan", "option", "cover"]
        ):
            wf.advance("recommendation")
        elif wf.stage == "recommendation" and any(
            kw in msg_lower for kw in ["select", "choose", "go with", "want this", "buy", "purchase"]
        ):
            wf.advance("selection")


# ── Environment-scoped log formatter ───────────────────────────────────────────

class _EnvFormatter(logging.Formatter):
    def __init__(self, domain: str):
        super().__init__()
        self._domain = domain.upper()

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.now().strftime("%H:%M:%S")
        level = record.levelname
        msg = record.getMessage()
        return f"[ENV:{self._domain}] {ts} {level} — {msg}"
