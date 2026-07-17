"""
Aegis AI — Central Orchestrator (Layer 2)
The ONLY component that can: route messages, transfer agents, share session context.
Agents never communicate directly — all routing goes through here.

NEW ARCHITECTURE (Intent Detection Engine integration):
  1. Force-transfer path (user approved) — bypasses everything
  2. Intent Detection Gate — check if IDE needs to run
     YES → Full 10-step IDE analysis → routing decision from IntentResult
     NO  → Skip detection, continue current workflow
  3. Agent Environment processing
  4. Agent-level domain boundary check (suggest_transfer)
  5. Executive AI intercept if transfer is suggested

Transfer Policy:
  - Agents SUGGEST transfers (suggest_transfer=True) — never auto-execute.
  - Transfers execute ONLY when force_transfer_to is set (user explicitly approved).
  - The user controls every agent switch.
"""
import json
from typing import Optional, List, Dict, Any
from pathlib import Path

from app.utils.logger import logger
from app.orchestrator.session_manager import SessionManager
from app.agents.agent_environment import EnvironmentResult
from app.intent.intent_engine import IntentDetectionEngine, IntentResult
from app.orchestrator.fast_intent_router import FastIntentRouter
from app.orchestrator.intent_cache import IntentCache
from app.orchestrator.interrupt_detector import InterruptDetector
from app.orchestrator.workflow_snapshot import WorkflowSnapshotStore


# Agent display names
AGENT_NAMES: Dict[str, str] = {
    "health":        "Sarah AI",
    "motor":         "Alex AI",
    "travel":        "Ethan AI",
    "home-property": "Emma AI",
    "executive":     "Sri AI",
}


class CentralOrchestrator:
    """
    Routes every incoming message to the correct specialist agent environment.
    Uses the Intent Detection Engine to decide when routing is needed.

    Key invariant:
      Intent Detection runs ONLY when required:
        • New conversation (no active session)
        • Bot page explicitly changed
        • Workflow completed or cancelled
        • Explicit domain change with high confidence

    Transfer rules:
      • suggest_transfer: agent detected out-of-domain → return suggestion, DON'T switch
      • force_transfer_to: user approved → snapshot + context export → route to new env
    """

    DEFAULT_AGENT = "executive"

    def __init__(self):
        self.llm_service    = None
        self.memory_engine  = None
        self.decision_engine = None
        self._load_shared_services()

        from app.orchestrator.environment_registry import EnvironmentRegistry
        self.registry = EnvironmentRegistry(
            self.llm_service, self.memory_engine, self.decision_engine
        )
        self.session_manager    = SessionManager()
        self.intent_engine      = IntentDetectionEngine()
        self.fast_router        = FastIntentRouter()
        self.intent_cache       = IntentCache(max_size=300, ttl_seconds=45.0)
        self.interrupt_detector = InterruptDetector()
        self.snapshot_store     = WorkflowSnapshotStore()

        logger.info(
            "[CentralOrchestrator] Initialized — "
            "IntentDetectionEngine, FastIntentRouter, InterruptDetector active, "
            "5 isolated environments online"
        )

    # ── Service loading ────────────────────────────────────────────────────────

    def _load_shared_services(self) -> None:
        try:
            from app.services.llm_service import get_llm_service
            self.llm_service = get_llm_service()
            logger.info("[CentralOrchestrator] LLM service loaded")
        except Exception as e:
            logger.error(f"[CentralOrchestrator] LLM service load failed: {e}")

        base = Path(__file__).resolve().parent.parent.parent.parent
        self._load_memory_engine(base)
        self._load_decision_engine(base)

    def _load_memory_engine(self, base: Path) -> None:
        import importlib.util
        l3 = base / "Aegis-AI" / "layer3" / "engine.py"
        if l3.exists():
            try:
                spec = importlib.util.spec_from_file_location("layer3_engine", str(l3))
                mod  = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                cls  = getattr(mod, "AegisMemoryEngine", None)
                if cls:
                    self.memory_engine = cls(base_dir=str(base / "Aegis-AI" / "layer3"))
                    logger.info("[CentralOrchestrator] Layer 3 Memory Engine loaded")
            except Exception as e:
                logger.error(f"[CentralOrchestrator] Memory Engine load failed: {e}")

    def _load_decision_engine(self, base: Path) -> None:
        import importlib.util
        l4 = base / "Aegis-AI" / "layer4" / "engine.py"
        if l4.exists():
            try:
                spec = importlib.util.spec_from_file_location("layer4_engine", str(l4))
                mod  = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                cls  = getattr(mod, "AegisDecisionEngine", None)
                if cls:
                    self.decision_engine = cls(base_dir=str(base / "Aegis-AI" / "layer4"))
                    logger.info("[CentralOrchestrator] Layer 4 Decision Engine loaded")
            except Exception as e:
                logger.error(f"[CentralOrchestrator] Decision Engine load failed: {e}")

    # ═══════════════════════════════════════════════════════════════════════════
    # MAIN DISPATCH
    # ═══════════════════════════════════════════════════════════════════════════

    async def dispatch(
        self,
        message: str,
        history: Optional[List[Dict]] = None,
        user_name: str = "Sri",
        session_id: Optional[str] = None,
        force_transfer_to: Optional[str] = None,
        initial_domain: Optional[str] = None,
        declined_domains: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Message routing pipeline:

        ┌─ FORCE TRANSFER (user approved) ──────────────────────────────────┐
        │  → _execute_forced_transfer()                                       │
        └────────────────────────────────────────────────────────────────────┘
        ┌─ INTENT DETECTION GATE ────────────────────────────────────────────┐
        │  needs_detection()? ──YES──► 10-step IDE analysis                  │
        │         │                        ├─ new_workflow  → assign agent    │
        │         │                        ├─ continue      → current agent   │
        │         │                        └─ request_transfer → exec intercept│
        │         NO                                                          │
        │         └──────────────────────► continue current agent             │
        └────────────────────────────────────────────────────────────────────┘
        """
        if not session_id:
            import uuid
            session_id = str(uuid.uuid4())

        history_list = history or []

        logger.info(
            f"[Orchestrator] ▶ session={session_id[:8]}, user={user_name}"
            + (f", force={force_transfer_to}" if force_transfer_to else "")
            + (f", page={initial_domain}" if initial_domain else "")
        )

        # ── 1. FORCE TRANSFER (user explicitly approved) ──────────────────────
        if force_transfer_to and self.registry.get(force_transfer_to):
            return await self._execute_forced_transfer(
                to_key=force_transfer_to,
                message=message,
                history=history_list,
                user_name=user_name,
                session_id=session_id,
            )

        # ── 2. READ SESSION STATE ─────────────────────────────────────────────
        active_agent     = self.session_manager.get_active_agent(session_id)
        workflow_status  = self.session_manager.get_workflow_status(session_id)
        workflow_stage   = self.session_manager.get_workflow_stage(session_id)

        # ── 2b. FAST INTENT ROUTER — pre-LLM transfer command detection ──────
        # Detects explicit "connect to X / switch to X / talk to X" commands
        # in <1ms without any LLM call. Returns suggest_transfer immediately.
        fir = self.fast_router.detect(message)
        if fir.detected and self.registry.get(fir.target_domain):
            from_key = active_agent or self.DEFAULT_AGENT
            if fir.target_domain != from_key:  # don't suggest transfer to same agent
                logger.info(
                    f"[Orchestrator:FIR] Transfer command detected → {fir.target_name} "
                    f"(conf={fir.confidence:.0%}, reason={fir.reason})"
                )
                return self._build_fast_transfer_suggestion(
                    from_key=from_key,
                    to_key=fir.target_domain,
                    to_name=fir.target_name,
                    session_id=session_id,
                )

        # ── 2c. INTERRUPT DETECTOR — mid-workflow domain switch ───────────────
        # Catches domain-switch signals that FIR misses:
        #   • "Actually motor insurance" (domain keyword, no trigger phrase)
        #   • "Forget health. Travel." (abandon signal + domain)
        #   • Messages > 12 words that FIR skips
        # Only fires when an active workflow exists.
        #
        # A domain the user already refused is never offered again: detection
        # still runs, but a declined target falls through to the active agent so
        # the message is actually answered. Re-offering it would return the
        # suggestion template as the reply — the user's question would never
        # reach the agent, and the UI suppresses the dialog, leaving the
        # question unanswerable.
        declined = set(declined_domains or ())
        if (
            active_agent
            and workflow_status == "active"
            and self.registry.get(active_agent)
        ):
            interrupt = self.interrupt_detector.detect(message, active_agent)
            if (
                interrupt.detected
                and self.registry.get(interrupt.target_domain)
                and interrupt.target_domain != active_agent
                and interrupt.target_domain not in declined
            ):
                logger.info(
                    f"[Orchestrator:Interrupt] Mid-workflow switch: "
                    f"{active_agent} → {interrupt.target_name} "
                    f"(conf={interrupt.confidence:.0%}, reason={interrupt.reason})"
                )
                self._save_workflow_snapshot(session_id, active_agent, history_list)
                return self._build_interrupt_suggestion(
                    from_key=active_agent,
                    to_key=interrupt.target_domain,
                    to_name=interrupt.target_name,
                    session_id=session_id,
                )

        # ── 3. INTENT DETECTION GATE (with cache) ────────────────────────────
        run_ide = self.intent_engine.needs_detection(
            active_agent=active_agent,
            message=message,
            initial_domain=initial_domain,
            workflow_status=workflow_status,
        )

        if run_ide:
            return await self._dispatch_with_ide(
                message=message,
                history_list=history_list,
                user_name=user_name,
                session_id=session_id,
                active_agent=active_agent,
                initial_domain=initial_domain,
                workflow_status=workflow_status,
                workflow_stage=workflow_stage,
            )
        else:
            return await self._dispatch_continue(
                message=message,
                history_list=history_list,
                user_name=user_name,
                session_id=session_id,
                active_agent=active_agent,
                initial_domain=initial_domain,
            )

    # ═══════════════════════════════════════════════════════════════════════════
    # DISPATCH WITH INTENT DETECTION
    # ═══════════════════════════════════════════════════════════════════════════

    async def _dispatch_with_ide(
        self,
        message: str,
        history_list: List[Dict],
        user_name: str,
        session_id: str,
        active_agent: Optional[str],
        initial_domain: Optional[str],
        workflow_status: str,
        workflow_stage: str,
    ) -> Dict[str, Any]:
        """
        Runs the 10-step Intent Detection pipeline and routes based on the result.
        """
        # ── Run full intent analysis (Steps 1–10) with cache ─────────────────
        intent: IntentResult = self.intent_cache.get(message, active_agent)
        if intent is None:
            intent = self.intent_engine.analyze(
                message=message,
                active_agent=active_agent,
                history=history_list,
                profile=None,
                initial_domain=initial_domain,
                workflow_status=workflow_status,
                workflow_stage=workflow_stage,
            )
            self.intent_cache.put(message, active_agent, intent)
        else:
            logger.debug(f"[Orchestrator:IDE] Cache hit — skipped 10-step analysis")

        logger.info(
            f"[Orchestrator:IDE] primary={intent.primary_intent} | "
            f"domain={intent.domain} | "
            f"conf={intent.confidence:.0%} | "
            f"action={intent.workflow_action} | "
            f"agent={AGENT_NAMES.get(intent.next_agent, intent.next_agent)} | "
            f"reason: {intent.reason}"
        )

        # Record intent for audit / multi-turn awareness
        self.session_manager.record_intent(session_id, intent.to_dict())

        # ── Route based on workflow_action ────────────────────────────────────

        if intent.workflow_action == "request_transfer":
            from_key = active_agent or self.DEFAULT_AGENT
            # Don't suggest transfer when already talking to that agent
            if intent.next_agent and intent.next_agent == from_key:
                logger.info(
                    f"[Orchestrator:IDE] Same-agent transfer suppressed — "
                    f"already active on {AGENT_NAMES.get(from_key, from_key)}"
                )
                env = self.registry.get(from_key) or self.registry.get(self.DEFAULT_AGENT)
                env_result = await env.process(message, session_id, user_name, history_list)
                self.session_manager.set_active_agent(session_id, from_key)
                self.session_manager.set_workflow_status(session_id, "active")
                self._sync_workflow_stage(session_id, env_result)
                return self._build_result(env_result, session_id, intent=intent)
            # User mentioned a different domain — Executive AI asks permission
            return await self._executive_route_intercept(
                from_key=from_key,
                to_key=intent.next_agent,
                message=message,
                history=history_list,
                user_name=user_name,
                session_id=session_id,
                intent=intent,
            )

        # Both "new_workflow" and "continue" from IDE → route to intent.next_agent
        target_key = intent.next_agent or self.DEFAULT_AGENT
        env = self.registry.get(target_key) or self.registry.get(self.DEFAULT_AGENT)
        if not self.registry.get(target_key):
            target_key = self.DEFAULT_AGENT

        env_result = await env.process(message, session_id, user_name, history_list)

        # Agent-level domain boundary check → Executive AI intercepts
        if env_result.suggest_transfer:
            transfer_target = env_result.transfer_to or self.DEFAULT_AGENT
            if transfer_target == target_key:
                # Agent flagged a domain it is already serving — ignore
                logger.debug(
                    f"[Orchestrator] Same-agent suggest_transfer suppressed for {target_key}"
                )
            else:
                logger.info(
                    f"[Orchestrator] Agent {target_key} flagged domain boundary → "
                    f"Executive AI coordinating transfer to {transfer_target}"
                )
                return await self._executive_route_intercept(
                    from_key=target_key,
                    to_key=transfer_target,
                    message=message,
                    history=history_list,
                    user_name=user_name,
                    session_id=session_id,
                )

        # Update session: new agent + workflow status
        self.session_manager.set_active_agent(session_id, target_key)
        self.session_manager.set_workflow_status(session_id, "active")
        self._sync_workflow_stage(session_id, env_result)

        logger.info(
            f"[Orchestrator] {'New workflow' if intent.workflow_action == 'new_workflow' else 'Routed'}: "
            f"agent={AGENT_NAMES.get(target_key, target_key)}, session={session_id[:8]}"
        )
        return self._build_result(env_result, session_id, intent=intent)

    # ═══════════════════════════════════════════════════════════════════════════
    # DISPATCH WITHOUT INTENT DETECTION (CONTINUATION)
    # ═══════════════════════════════════════════════════════════════════════════

    async def _dispatch_continue(
        self,
        message: str,
        history_list: List[Dict],
        user_name: str,
        session_id: str,
        active_agent: Optional[str],
        initial_domain: Optional[str],
    ) -> Dict[str, Any]:
        """
        Intent detection was skipped — continue the current workflow directly.
        No domain analysis, no agent switching. Pure continuation.
        """
        target_key = active_agent or initial_domain or self.DEFAULT_AGENT

        logger.info(
            f"[Orchestrator] ✓ Continue workflow: "
            f"agent={AGENT_NAMES.get(target_key, target_key)}, "
            f"IDE=SKIPPED, session={session_id[:8]}"
        )

        env = self.registry.get(target_key) or self.registry.get(self.DEFAULT_AGENT)
        env_result = await env.process(message, session_id, user_name, history_list)

        # Agent-level domain boundary check still applies (e.g., "I also need car insurance")
        if env_result.suggest_transfer:
            transfer_target = env_result.transfer_to or self.DEFAULT_AGENT
            if transfer_target != target_key:
                return await self._executive_route_intercept(
                    from_key=target_key,
                    to_key=transfer_target,
                    message=message,
                    history=history_list,
                    user_name=user_name,
                    session_id=session_id,
                )

        self.session_manager.set_active_agent(session_id, target_key)
        self._sync_workflow_stage(session_id, env_result)
        return self._build_result(env_result, session_id)

    # ── Fast transfer suggestion (no LLM) ─────────────────────────────────────

    def _build_fast_transfer_suggestion(
        self,
        from_key: str,
        to_key: str,
        to_name: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Returns a transfer suggestion instantly — no LLM call needed.
        Used when FastIntentRouter detects an explicit "connect to X" command.
        The TransferDialog will show YES/NO to the user.
        """
        from_name    = AGENT_NAMES.get(from_key, "Current Advisor")
        domain_label = to_key.replace("-", " ").title()

        text = (
            f"{to_name} is our specialist for {domain_label} Insurance. "
            f"Shall I connect you?"
        )

        return {
            "reply":           text,
            "agent_name":      from_name,
            "agent_domain":    from_key,
            "transferred":     False,
            "suggest_transfer": True,
            "transfer_from":    from_key,
            "transfer_from_name": from_name,
            "transfer_to":      to_key,
            "transfer_to_name": to_name,
            "transfer_reason":  f"{to_key.replace('-', ' ')} insurance",
            "previous_agent":   self.session_manager.get_previous_agent(session_id),
            "session_id":       session_id,
            "env_metadata":     {"fast_router": True},
        }

    # ── Workflow snapshot helpers (for interrupt recovery) ────────────────────

    def _save_workflow_snapshot(
        self,
        session_id: str,
        domain: str,
        history: List[Dict],
    ) -> None:
        """
        Captures the current workflow state before an interrupt-triggered switch.
        Exports agent context (profile + rec) so the user can resume seamlessly.
        """
        stage = self.session_manager.get_workflow_stage(session_id)
        env = self.registry.get(domain)
        profile_data: Dict = {}
        rec_data = None

        if env:
            try:
                exported = env.export_session_context(session_id)
                profile_data = exported.get("profile", {}) or {}
                rec_data = exported.get("recommendation") or None
                self.session_manager.store_environment_context(session_id, domain, exported)
            except Exception as e:
                logger.warning(f"[Orchestrator:Interrupt] Context export failed for {domain}: {e}")

        self.snapshot_store.save(
            session_id=session_id,
            domain=domain,
            stage=stage,
            history=history,
            profile_data=profile_data,
            rec_data=rec_data,
        )

    def _build_interrupt_suggestion(
        self,
        from_key: str,
        to_key: str,
        to_name: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Returns an interrupt transfer suggestion immediately — no LLM needed.
        The `is_interrupt=True` flag tells the frontend to show the specialized
        InterruptDialog ("progress saved" messaging) instead of the generic
        TransferDialog.
        """
        from_name  = AGENT_NAMES.get(from_key, "Current Advisor")
        from_label = from_key.replace("-", " ").title()
        to_label   = to_key.replace("-", " ").title()

        text = (
            f"I noticed you'd like to explore **{to_label} Insurance**.\n\n"
            f"Your current progress with **{from_label} Insurance** has been safely "
            f"saved — you can return to it at any time.\n\n"
            f"Shall I connect you with **{to_name}**, "
            f"our {to_label} Insurance specialist?"
        )

        return {
            "reply":              text,
            "agent_name":         from_name,
            "agent_domain":       from_key,
            "transferred":        False,
            "suggest_transfer":   True,
            "is_interrupt":       True,
            "transfer_from":      from_key,
            "transfer_from_name": from_name,
            "transfer_to":        to_key,
            "transfer_to_name":   to_name,
            "transfer_reason":    f"{to_key.replace('-', ' ')} insurance",
            "previous_agent":     self.session_manager.get_previous_agent(session_id),
            "session_id":         session_id,
            "env_metadata":       {"interrupt": True, "snapshot_saved": True},
        }

    # ── Executive AI coordinator (domain mismatch intercept) ──────────────────

    async def _executive_route_intercept(
        self,
        from_key: str,
        to_key: str,
        message: str,
        history: List[Dict],
        user_name: str,
        session_id: str,
        intent: Optional[IntentResult] = None,
    ) -> Dict[str, Any]:
        """
        When domain mismatch is detected, Executive AI intercepts and asks the
        customer's permission to connect them to the right specialist.
        The current agent stays completely silent.
        """
        from_name = AGENT_NAMES.get(from_key, "Current Advisor")
        to_name   = AGENT_NAMES.get(to_key,   "Specialist Advisor")

        exec_env = self.registry.get("executive")
        if exec_env:
            exec_result = await exec_env.coordinate_transfer(
                from_key=from_key,
                from_name=from_name,
                to_key=to_key,
                to_name=to_name,
                user_message=message,
                user_name=user_name,
                session_id=session_id,
                history=history,
            )
        else:
            detected_display = to_key.replace("-", " ").title()
            exec_result = EnvironmentResult(
                text=(
                    f"I can see you're asking about **{detected_display} Insurance**. "
                    f"**{to_name}** is our specialist for this — shall I connect you? "
                    "Your session and history will be preserved."
                ),
                agent_name="Executive AI",
                agent_domain="executive",
                suggest_transfer=True,
                transfer_to=to_key,
                transfer_to_name=to_name,
                session_id=session_id,
            )

        secondary_intent_label = getattr(intent, "secondary_intent", None) if intent else None
        intent_conf = getattr(intent, "confidence", None) if intent else None

        return {
            "reply": exec_result.text,
            "agent_name": exec_result.agent_name,
            "agent_domain": exec_result.agent_domain,
            "transferred": False,
            "suggest_transfer": True,
            "transfer_from": from_key,
            "transfer_from_name": from_name,
            "transfer_to": to_key,
            "transfer_to_name": to_name,
            "transfer_reason": f"{to_key.replace('-', ' ')} insurance enquiry",
            "previous_agent": self.session_manager.get_previous_agent(session_id),
            "session_id": session_id,
            "env_metadata": {
                "coordinator": "executive",
                "secondary_intent": secondary_intent_label,
                "intent_confidence": intent_conf,
            },
        }

    # ── Forced transfer (user-approved) ────────────────────────────────────────

    async def _execute_forced_transfer(
        self,
        to_key: str,
        message: str,
        history: List[Dict],
        user_name: str,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Executes a transfer the user explicitly approved.
        1. Export context from current environment.
        2. Import context into target environment.
        3. Call process_forced() on target (bypasses domain check).
        4. Update session to new agent.
        """
        from_key  = self.session_manager.get_active_agent(session_id) or self.DEFAULT_AGENT
        from_name = AGENT_NAMES.get(from_key, "Previous Advisor")

        self.session_manager.save_snapshot(session_id)
        logger.info(
            f"[Orchestrator] Forced transfer: {from_key} → {to_key}, session={session_id[:8]}"
        )

        from_env = self.registry.get(from_key)
        ctx = from_env.export_session_context(session_id) if from_env else {}
        if ctx:
            self.session_manager.store_environment_context(session_id, from_key, ctx)

        incoming_env = self.registry.get(to_key)
        if not incoming_env:
            logger.error(f"[Orchestrator] No environment for domain: {to_key}")
            incoming_env = self.registry.get(self.DEFAULT_AGENT)
            to_key = self.DEFAULT_AGENT

        if ctx:
            incoming_env.import_session_context(session_id, ctx)

        env_result: EnvironmentResult = await incoming_env.process_forced(
            message=message,
            session_id=session_id,
            user_name=user_name,
            history=history,
        )

        self.session_manager.set_active_agent(
            session_id, to_key, reason=f"user_approved_from_{from_key}"
        )
        self.session_manager.set_workflow_status(session_id, "active")
        self._sync_workflow_stage(session_id, env_result)

        return {
            "reply": env_result.text,
            "agent_name": incoming_env.name,
            "agent_domain": to_key,
            "transferred": True,
            "suggest_transfer": False,
            "transfer_from": from_key,
            "transfer_from_name": from_name,
            "transfer_to": to_key,
            "transfer_to_name": incoming_env.name,
            "transfer_reason": None,
            "previous_agent": from_key,
            "session_id": session_id,
            "env_metadata": {
                "domain": to_key,
                "transferred_from": from_key,
                "forced": True,
            },
        }

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _build_result(
        self,
        result: Any,
        session_id: str,
        intent: Optional[IntentResult] = None,
    ) -> Dict[str, Any]:
        """Convert EnvironmentResult to the plain dict the rest of the system expects."""
        meta = getattr(result, "env_metadata", {}) or {}
        if intent:
            meta["intent_domain"]     = intent.domain
            meta["intent_confidence"] = round(intent.confidence, 3)
            meta["intent_action"]     = intent.workflow_action
            meta["intent_reason"]     = intent.reason

        return {
            "reply": result.text,
            "agent_name": result.agent_name,
            "agent_domain": result.agent_domain,
            "transferred": getattr(result, "transferred", False),
            "suggest_transfer": False,
            "transfer_from": None,
            "transfer_from_name": None,
            "transfer_to": None,
            "transfer_to_name": None,
            "transfer_reason": None,
            "previous_agent": self.session_manager.get_previous_agent(session_id),
            "session_id": session_id,
            "env_metadata": meta,
        }

    def _sync_workflow_stage(self, session_id: str, env_result: Any) -> None:
        """Sync the workflow stage from the environment result into the session."""
        stage = (getattr(env_result, "env_metadata", {}) or {}).get("workflow_stage")
        if stage:
            self.session_manager.set_workflow_stage(session_id, stage)

    # ── Environment health ─────────────────────────────────────────────────────

    def get_environment_health(self) -> Dict[str, Any]:
        return self.registry.health_report()

    # ── Executive governance approval (Layer 5) ────────────────────────────────

    async def executive_approve(
        self, recommendation: dict, profile: dict, agent_name: str
    ) -> dict:
        try:
            exec_env = self.registry.get("executive")
            if exec_env:
                exec_ai = exec_env.agent
                if hasattr(exec_ai, "approve_recommendation"):
                    return await exec_ai.approve_recommendation(
                        recommendation, profile, agent_name
                    )
        except Exception as e:
            logger.error(f"[Orchestrator] Executive approval error: {e}")
        return {
            "status": "Approved With Conditions",
            "notes": "Standard eligibility conditions apply. Verify documents before purchase.",
        }

    # ── Session info ───────────────────────────────────────────────────────────

    def get_session_info(self, session_id: str) -> Dict[str, Any]:
        return {
            "session_id": session_id,
            "active_agent":    self.session_manager.get_active_agent(session_id),
            "previous_agent":  self.session_manager.get_previous_agent(session_id),
            "workflow_status": self.session_manager.get_workflow_status(session_id),
            "workflow_stage":  self.session_manager.get_workflow_stage(session_id),
            "last_intent":     self.session_manager.get_last_intent(session_id),
            "transfer_history": self.session_manager.get_transfer_history(session_id),
            "total_active_sessions": self.session_manager.active_count,
        }

    # ── Backward compatibility: kept for any code still calling detect_domain() ─

    def detect_domain(self, message: str, history=None) -> str:
        """
        DEPRECATED — use IntentDetectionEngine.analyze() instead.
        Kept for backward compatibility with any external callers.
        """
        msg_lower = message.lower()
        lexicon_map = {
            "motor":         ["car", "bike", "vehicle", "motor", "creta", "enfield", "idv", "ncb"],
            "travel":        ["travel", "trip", "flight", "abroad", "visa", "schengen"],
            "home-property": ["home", "house", "property", "apartment", "landlord"],
            "health":        ["health", "medical", "hospital", "doctor", "critical illness"],
            "executive":     ["executive", "corporate", "business insurance", "d&o"],
        }
        for domain, keywords in lexicon_map.items():
            if any(kw in msg_lower for kw in keywords):
                return domain
        return self.DEFAULT_AGENT
