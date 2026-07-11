"""
Aegis AI — UI Action Engine (Layer 6)

Handles all button-click events from the frontend as structured UI events.
Completely bypasses Intent Detection, Category Routing, and Recommendation Generation.
"""

import re
import uuid
from typing import Dict, Optional
from app.utils.logger import logger

# ---------------------------------------------------------------------------
# In-memory session store  (keyed by session_id UUID)
# ---------------------------------------------------------------------------
_sessions: Dict[str, dict] = {}


class SessionContextManager:
    """Stores and retrieves recommendation sessions independent of the chat pipeline."""

    def create(self, data: dict) -> str:
        session_id = str(uuid.uuid4())
        _sessions[session_id] = data
        logger.info(f"SessionContextManager: created session {session_id}")
        return session_id

    def store(self, session_id: str, data: dict) -> str:
        _sessions[session_id] = data
        return session_id

    def get(self, session_id: str) -> Optional[dict]:
        return _sessions.get(session_id)

    def update(self, session_id: str, updates: dict) -> dict:
        if session_id in _sessions:
            _sessions[session_id].update(updates)
        return _sessions.get(session_id, {})


# ---------------------------------------------------------------------------
# Action handler engines
# ---------------------------------------------------------------------------

class PlanDetailEngine:
    """Handles the view_details action."""

    def handle(self, session: dict) -> dict:
        plan = session.get("selectedPlan") or session
        return {
            "response_type": "navigate",
            "url": "/policies/details",
            "planData": plan,
            "message": f"Opening full details for **{plan.get('planName', 'your plan')}**.",
        }


class PlanComparisonEngine:
    """Handles the compare_plans action — returns structured comparison data."""

    def handle(self, session: dict) -> dict:
        plan = session.get("selectedPlan") or session
        alt = plan.get("alternativePlan")

        comparison = {
            "primary": {
                "planName": plan.get("planName"),
                "premium": plan.get("premium"),
                "coverage": plan.get("coverage"),
                "claimSettlementRatio": plan.get("claimSettlementRatio", "99.1%"),
                "riskLevel": plan.get("riskLevel", "Low Risk"),
                "score": plan.get("score", 98),
                "waitingPeriod": plan.get("waitingPeriod", ""),
                "benefits": plan.get("benefits", []),
                "executiveApproval": plan.get("executiveApproval", "Approved"),
                "label": "Recommended Plan",
                "badge": "BEST MATCH",
            }
        }

        if alt:
            comparison["alternative"] = {
                "planName": alt.get("planName"),
                "premium": alt.get("premium"),
                "coverage": alt.get("coverage"),
                "claimSettlementRatio": alt.get("claimSettlementRatio", "98.4%"),
                "riskLevel": alt.get("riskLevel", "Low Risk"),
                "score": alt.get("score", 85),
                "waitingPeriod": alt.get("waitingPeriod", ""),
                "benefits": alt.get("benefits", []),
                "executiveApproval": alt.get("executiveApproval", "Approved"),
                "label": "Value for Money",
                "badge": "ALTERNATIVE",
            }

        return {
            "response_type": "navigate",
            "url": "/policies/details?compare=true",
            "planData": plan,
            "comparison": comparison,
            "message": "Opening side-by-side comparison view.",
        }


class PurchaseEngine:
    """Handles select_plan and purchase_plan actions."""

    def _parse_premium(self, premium_str: str) -> int:
        try:
            m = re.search(r"[\d,]+", premium_str.replace(",", ""))
            return int(m.group().replace(",", "")) if m else 850
        except Exception:
            return 850

    def handle_select(self, session: dict) -> dict:
        plan = session.get("selectedPlan") or session
        profile = session.get("customerProfile", {})

        premium_num = self._parse_premium(plan.get("premium", "850"))
        gst = round(premium_num * 0.18)
        total = premium_num + gst

        return {
            "response_type": "select_plan_summary",
            "planName": plan.get("planName"),
            "category": plan.get("category", "health"),
            "coverage": plan.get("coverage"),
            "premium": plan.get("premium"),
            "benefits": plan.get("benefits", []),
            "riskLevel": plan.get("riskLevel", "Low Risk"),
            "score": plan.get("score", 98),
            "confidenceScore": plan.get("confidenceScore", 0.98),
            "executiveApproval": plan.get("executiveApproval", "Approved"),
            "premiumBreakdown": {
                "base": f"₹{premium_num:,}",
                "gst": f"₹{gst:,}",
                "total": f"₹{total:,}/month",
            },
            "customerProfile": profile,
            "message": (
                f"Plan locked: **{plan.get('planName', 'Selected Plan')}**. "
                "Proceeding to underwriting qualification form."
            ),
        }

    def handle_purchase(self, session: dict) -> dict:
        plan = session.get("selectedPlan") or session
        return {
            "response_type": "purchase_flow",
            "planName": plan.get("planName"),
            "premium": plan.get("premium"),
            "coverage": plan.get("coverage"),
            "executiveApproval": plan.get("executiveApproval", "Approved"),
            "requiredFields": [
                "fullName", "dateOfBirth", "email", "phone", "address",
            ],
            "message": (
                f"Initiating purchase journey for **{plan.get('planName', 'your plan')}**. "
                "Collecting only missing details."
            ),
        }


# ---------------------------------------------------------------------------
# Central dispatcher
# ---------------------------------------------------------------------------

class UIActionDispatcher:
    """
    Routes UI action events to the appropriate engine.
    Never invokes Intent Detection, Category Detection, or Recommendation Generation.
    """

    SUPPORTED_ACTIONS = {
        "view_details",
        "compare_plans",
        "select_plan",
        "purchase_plan",
        "download_brochure",
        "share_plan",
        "contact_advisor",
        "schedule_callback",
    }

    def __init__(self):
        self.session_manager = SessionContextManager()
        self.detail_engine = PlanDetailEngine()
        self.comparison_engine = PlanComparisonEngine()
        self.purchase_engine = PurchaseEngine()

    def dispatch(
        self,
        action: str,
        session_id: Optional[str],
        session_data: Optional[dict],
    ) -> tuple[dict, str]:
        """
        Returns (result_dict, resolved_session_id).
        """
        if action not in self.SUPPORTED_ACTIONS:
            return (
                {"response_type": "error", "message": f"Unknown action '{action}'"},
                session_id or "unknown",
            )

        # Resolve / persist session
        resolved_id = session_id or str(uuid.uuid4())
        session = {}

        if session_id:
            session = self.session_manager.get(session_id) or {}

        if session_data:
            # Always refresh session with latest frontend state
            merged = {**session, **session_data}
            self.session_manager.store(resolved_id, merged)
            session = merged

        logger.info(f"UIActionDispatcher: action={action}, session_id={resolved_id}")

        if action == "view_details":
            return self.detail_engine.handle(session), resolved_id

        if action == "compare_plans":
            return self.comparison_engine.handle(session), resolved_id

        if action == "select_plan":
            return self.purchase_engine.handle_select(session), resolved_id

        if action in ("purchase_plan", "download_brochure", "share_plan"):
            return self.purchase_engine.handle_purchase(session), resolved_id

        if action in ("contact_advisor", "schedule_callback"):
            return (
                {
                    "response_type": "contact_flow",
                    "message": "Connecting you with a live Aegis advisor. Please stand by.",
                },
                resolved_id,
            )

        return {"response_type": "error", "message": "Unhandled action"}, resolved_id
