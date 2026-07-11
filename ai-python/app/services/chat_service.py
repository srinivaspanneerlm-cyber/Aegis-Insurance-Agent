"""
Aegis AI — Chat Service (Orchestrator Delegate)
This module is now a thin facade over the CentralOrchestrator.
All domain routing, agent selection, domain boundary enforcement,
session management, and response generation is handled by the orchestrator.
"""
import json
import re
from typing import List, Optional, Dict, Any
from app.models.schemas import ChatHistoryMessage
from app.utils.logger import logger


class ChatService:
    """
    Public interface for the Aegis AI conversation engine.
    Delegates everything to CentralOrchestrator — the single source of truth.
    """

    def __init__(self):
        logger.info("[ChatService] Initializing Aegis AI Multi-Agent Orchestrator...")
        self._orchestrator = None
        self._init_orchestrator()

    def _init_orchestrator(self):
        try:
            from app.orchestrator.central_orchestrator import CentralOrchestrator
            self._orchestrator = CentralOrchestrator()
            logger.info("[ChatService] CentralOrchestrator ready — 5 agents online")
        except Exception as e:
            logger.error(f"[ChatService] Orchestrator init failed: {e}")
            self._orchestrator = None

    # ── Public API ─────────────────────────────────────────────────────────────

    async def dispatch(
        self,
        user_message: str,
        history: Optional[List[ChatHistoryMessage]] = None,
        user_name: Optional[str] = "Sri",
        product_type: Optional[str] = None,
        session_id: Optional[str] = None,
        force_transfer_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full dispatch — returns a dict with reply, agent_name, agent_domain,
        transferred, suggest_transfer, transfer_from, transfer_to, session_id, etc.

        force_transfer_to: domain key to route directly to (user already approved transfer).
        """
        history_list = self._normalize_history(history)

        if self._orchestrator:
            try:
                result = await self._orchestrator.dispatch(
                    message=user_message,
                    history=history_list,
                    user_name=user_name or "Sri",
                    session_id=session_id,
                    force_transfer_to=force_transfer_to,
                    initial_domain=product_type,
                )
                logger.info(
                    f"[ChatService] Response from {result.get('agent_name','?')} "
                    f"(transferred={result.get('transferred', False)}, "
                    f"suggest_transfer={result.get('suggest_transfer', False)})"
                )
                return result
            except Exception as e:
                logger.error(f"[ChatService] Orchestrator dispatch error: {e}")

        # Graceful fallback if orchestrator is down
        return self._fallback_response(user_message, user_name, product_type, session_id)

    async def generate_response(
        self,
        user_message: str,
        history: Optional[List[ChatHistoryMessage]] = None,
        user_name: Optional[str] = "Sri",
        product_type: Optional[str] = None,
        session_id: Optional[str] = None,
        force_transfer_to: Optional[str] = None,
    ) -> str:
        """
        Backward-compatible str-returning wrapper around dispatch().
        Used by callers that only need the text reply.
        """
        result = await self.dispatch(user_message, history, user_name, product_type, session_id, force_transfer_to)
        return result.get("reply", self._emergency_fallback(user_name))

    # ── History normalization ──────────────────────────────────────────────────

    @staticmethod
    def _normalize_history(history) -> List[Dict]:
        if not history:
            return []
        result = []
        for h in history:
            if isinstance(h, dict):
                result.append({"sender": h.get("sender", "user"), "message": h.get("message", "")})
            else:
                result.append({
                    "sender": getattr(h, "sender", "user"),
                    "message": getattr(h, "message", ""),
                })
        return result

    # ── Fallbacks ──────────────────────────────────────────────────────────────

    def _fallback_response(
        self,
        message: str,
        user_name: Optional[str],
        product_type: Optional[str],
        session_id: Optional[str],
    ) -> Dict[str, Any]:
        """Resilient fallback when orchestrator is unavailable."""
        name = user_name or "there"
        domain = product_type or "health"
        agent_names = {
            "health": "Sarah AI", "motor": "Alex AI",
            "travel": "Ethan AI", "home-property": "Emma AI",
            "property": "Emma AI", "miscellaneous": "Executive AI",
        }
        agent = agent_names.get(domain, "Sarah AI")
        return {
            "reply": (
                f"Hello {name}, I'm {agent} at Aegis AI. "
                "I'm experiencing a brief technical interruption. "
                "Please try your question again in a moment — I'm ready to assist you."
            ),
            "agent_name": agent,
            "agent_domain": domain,
            "transferred": False,
            "suggest_transfer": False,
            "transfer_from": None,
            "transfer_from_name": None,
            "transfer_to": None,
            "transfer_to_name": None,
            "transfer_reason": None,
            "previous_agent": None,
            "session_id": session_id or "",
        }

    @staticmethod
    def _emergency_fallback(user_name: Optional[str]) -> str:
        return (
            f"Hello {user_name or 'there'}, welcome to Aegis AI. "
            "Our advisory team is ready to help with Health, Motor, Travel, "
            "and Property insurance. How can I assist you today?"
        )
