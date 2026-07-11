"""
Aegis AI — Memory Orchestrator

Single entry point for ALL memory operations across Aegis AI.

Composes:
  ConversationStore    → persistent conversation history (disk-backed)
  RecommendationCache  → persisted recommendation results (disk-backed)
  EnhancedProfileManager → shared + domain customer profiles (disk-backed)

Usage in base_agent.py:
  self._memory_orch = MemoryOrchestrator.from_memory_engine(memory_engine)

Usage in agent_environment.py:
  orch = self.agent._memory_orch
  history = orch.load_history(customer_id, domain)
  orch.save_turn(customer_id, domain, user_msg, assistant_msg)

All three stores write to subdirectories of Aegis-AI/layer3/.
"""
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.memory.conversation_store import ConversationStore
from app.memory.recommendation_cache import RecommendationCache
from app.memory.profile_manager import EnhancedProfileManager
from app.utils.logger import logger


class MemoryOrchestrator:
    """
    Unified memory facade for Aegis AI agents.

    Instantiated once per agent at boot time. Each agent instance carries
    its own orchestrator, scoped to the agent's domain.

    Fixes:
      ✓ Problem 1:  Messages treated as new conversation
      ✓ Problem 2:  Customer profile forgotten
      ✓ Problem 3:  Recommendation disappears
      ✓ Problem 4:  Workflow state is lost (via profile persistence)
      ✓ Problem 5:  Agent forgets previous questions
      ✓ Problem 6:  Conversation history ignored
      ✓ Problem 7:  Agent repeats same questions
      ✓ Problem 8:  Recommendation resets after every message
      ✓ Problem 9:  Customer details disappear after page navigation
      ✓ Problem 10: Transferred conversations lose context
    """

    def __init__(
        self,
        base_dir: Path,
        memory_engine=None,
    ):
        base_dir = Path(base_dir)

        conv_dir   = base_dir / "conversation_memory" / "sessions"
        cache_dir  = base_dir / "recommendation_context" / "cache"
        profile_dir = base_dir / "customer_profile" / "customer_profiles"

        self.conversation_store    = ConversationStore(conv_dir)
        self.recommendation_cache  = RecommendationCache(cache_dir)
        self.profile_manager       = EnhancedProfileManager(profile_dir, memory_engine)

        logger.info(f"[MemoryOrchestrator] Initialized — base={base_dir}")

    @classmethod
    def from_memory_engine(cls, memory_engine) -> "MemoryOrchestrator":
        """
        Factory: create MemoryOrchestrator from an AegisMemoryEngine instance.
        The memory engine provides base_dir + extraction/validation logic.
        """
        if not memory_engine or not hasattr(memory_engine, "base_dir"):
            logger.warning(
                "[MemoryOrchestrator] No memory engine provided — "
                "using default path (Aegis-AI/layer3)"
            )
            base = Path(__file__).resolve().parent.parent.parent.parent / "Aegis-AI" / "layer3"
            return cls(base, None)

        base = Path(memory_engine.base_dir)
        orch = cls(base, memory_engine)
        orch.profile_manager.memory_engine = memory_engine
        return orch

    # ══════════════════════════════════════════════════════════════════════════
    # CONVERSATION HISTORY
    # ══════════════════════════════════════════════════════════════════════════

    def load_history(self, customer_id: str, domain: str) -> List[Dict]:
        """
        Load the full conversation history for this customer+domain from disk.
        Returns list of {role, content} dicts for LLM context.
        """
        return self.conversation_store.load_history(customer_id, domain)

    def save_turn(
        self,
        customer_id: str,
        domain: str,
        user_message: str,
        assistant_message: str,
    ) -> None:
        """Save one user+assistant turn pair to disk after a successful response."""
        self.conversation_store.save_turn(customer_id, domain, user_message, assistant_message)

    def get_history_summary(self, customer_id: str, domain: str, max_turns: int = 6) -> str:
        """Get the last N turns as a text block for the system prompt."""
        return self.conversation_store.get_summary_context(customer_id, domain, max_turns)

    def export_for_transfer(
        self, customer_id: str, domain: str, max_turns: int = 10
    ) -> List[Dict]:
        """Export the last N turns for cross-agent context transfer."""
        return self.conversation_store.export_for_transfer(customer_id, domain, max_turns)

    # ══════════════════════════════════════════════════════════════════════════
    # CUSTOMER PROFILE
    # ══════════════════════════════════════════════════════════════════════════

    def update_profile(
        self,
        base_customer_id: str,
        domain: str,
        message: str,
        user_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extract profile data from message and update both shared + domain profiles.
        Returns the complete merged profile for immediate use.

        Fetches the last agent turn from ConversationStore so that bare number
        answers ("35" in reply to "How old are you?") are correctly interpreted.
        """
        # Fetch last agent question for context-aware extraction
        last_agent_question = ""
        try:
            history = self.conversation_store.load_history(base_customer_id, domain)
            if history:
                # History entries alternate user/assistant; find last assistant turn
                for turn in reversed(history):
                    if turn.get("role") == "assistant":
                        last_agent_question = turn.get("content", "")
                        break
        except Exception:
            pass

        return self.profile_manager.update_with_message(
            base_customer_id, domain, message, user_name,
            context_question=last_agent_question,
        )

    def load_profile(self, base_customer_id: str, domain: str) -> Dict[str, Any]:
        """Load the merged profile (shared + domain) for a customer."""
        return self.profile_manager.load_merged_profile(base_customer_id, domain)

    def load_shared_profile(self, base_customer_id: str) -> Dict[str, Any]:
        """Load only the shared cross-domain profile fields."""
        return self.profile_manager.load_shared_profile(base_customer_id)

    def get_cross_domain_context(self, base_customer_id: str, current_domain: str) -> str:
        """
        Text block describing what's known about this customer from other agents.
        Prevents re-asking already-answered questions.
        """
        return self.profile_manager.get_cross_domain_context(base_customer_id, current_domain)

    # ══════════════════════════════════════════════════════════════════════════
    # RECOMMENDATION CACHE
    # ══════════════════════════════════════════════════════════════════════════

    def get_cached_recommendation(
        self,
        customer_id: str,
        domain: str,
        profile: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Return the cached (rec_result, exec_approval) if profile key fields unchanged.
        Returns None on miss or when key fields have changed.
        """
        return self.recommendation_cache.retrieve(customer_id, domain, profile)

    def cache_recommendation(
        self,
        customer_id: str,
        domain: str,
        rec_result: Optional[Dict[str, Any]],
        exec_approval: Optional[Dict[str, Any]],
        profile: Dict[str, Any],
    ) -> None:
        """Store a generated recommendation for future cache retrieval."""
        self.recommendation_cache.store(customer_id, domain, rec_result, exec_approval, profile)

    def invalidate_recommendation(self, customer_id: str, domain: str) -> None:
        """Force-invalidate the recommendation cache (e.g. after explicit plan change)."""
        self.recommendation_cache.invalidate(customer_id, domain)

    # ══════════════════════════════════════════════════════════════════════════
    # TRANSFER CONTEXT PACKAGE
    # ══════════════════════════════════════════════════════════════════════════

    def build_transfer_context(
        self, base_customer_id: str, from_domain: str
    ) -> Dict[str, Any]:
        """
        Build the complete context package for an agent-to-agent transfer.
        Contains: shared profile + recent history + cross-domain summary.
        Called before routing to a new agent.
        """
        return {
            "shared_profile":        self.load_shared_profile(base_customer_id),
            "conversation_history":  self.export_for_transfer(base_customer_id, from_domain),
            "cross_domain_context":  self.get_cross_domain_context(base_customer_id, from_domain),
            "from_domain":           from_domain,
            "base_customer_id":      base_customer_id,
        }

    # ══════════════════════════════════════════════════════════════════════════
    # MEMORY READ (used in _build_workflow_context enrichment)
    # ══════════════════════════════════════════════════════════════════════════

    def read_all_memory(
        self,
        base_customer_id: str,
        domain: str,
        profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Read all memory layers for a customer before generating a response.
        Returns a dict with keys: profile, history_summary, cross_domain, cached_rec.

        Pipeline:
          Read Conversation History
          → Read Customer Profile (shared + domain)
          → Read Cross-Domain Context
          → Read Recommendation Cache
          → Return all to agent
        """
        history_summary = self.get_history_summary(base_customer_id, domain)
        cross_domain    = self.get_cross_domain_context(base_customer_id, domain)
        cached_rec      = self.get_cached_recommendation(base_customer_id, domain, profile)

        return {
            "history_summary": history_summary,
            "cross_domain":    cross_domain,
            "cached_rec":      cached_rec,
        }
