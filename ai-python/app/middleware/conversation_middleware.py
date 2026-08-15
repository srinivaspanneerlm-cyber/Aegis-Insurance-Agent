"""
Aegis AI — Conversation State Middleware

Reusable pre-flight middleware shared by ALL specialist agents.
Runs before every LLM call to:

  1. Determine conversation STATE (9-state machine)
  2. Detect customer INTENT (explain / compare / purchase / general)
  3. Manage RECOMMENDATION LOCK (never regenerate card unless profile changed)
  4. Build STRUCTURED PROFILE VIEW (coverageType, memberCount, eldestAge, ...)
  5. Produce MIDDLEWARE CONTEXT consumed by _build_workflow_context()

States:
  Greeting → Qualification → Data Collection → Recommendation Analysis →
  Recommendation Presented → Comparison → Purchase →
  Transfer Pending → Transfer Completed
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any

from app.utils.money import parse_amount


# ── States ─────────────────────────────────────────────────────────────────────

class ConversationState(str, Enum):
    GREETING                 = "Greeting"
    QUALIFICATION            = "Qualification"
    DATA_COLLECTION          = "Data Collection"
    RECOMMENDATION_ANALYSIS  = "Recommendation Analysis"
    RECOMMENDATION_PRESENTED = "Recommendation Presented"
    COMPARISON               = "Comparison"
    PURCHASE                 = "Purchase"
    TRANSFER_PENDING         = "Transfer Pending"
    TRANSFER_COMPLETED       = "Transfer Completed"


# ── Intents ────────────────────────────────────────────────────────────────────

class ConversationIntent(str, Enum):
    EXPLAIN   = "explain"    # "Why this plan?" / "Explain the recommendation"
    COMPARE   = "compare"    # "Cheaper?" / "Compare plans" / "Alternative?"
    PURCHASE  = "purchase"   # "Buy this" / "Proceed" / "Apply now"
    GENERAL   = "general"    # Profile data or unclassified message


_EXPLAIN_KW = [
    "why this", "why did you", "why select", "why recommend", "why choose",
    "explain", "reasoning", "what makes", "how did you", "basis of",
    "why this plan", "justify", "rationale", "tell me why", "reason for",
    "why did you pick", "why not", "how is this", "what is the reasoning",
]
_COMPARE_KW = [
    "cheaper", "less expensive", "lower premium", "compare", "alternative",
    "better option", "other plan", "different plan", "something cheaper",
    "anything else", "other options", "show me more", "compare plans",
    # How people actually ask, in the singular: "can you show me another
    # option?" carried none of the plural phrasings above and was read as an
    # ordinary follow-up, so the request for an alternative went unanswered.
    "another option", "another plan", "other option", "next best",
    "next-best", "what else", "anything cheaper", "any other",
    "premium difference", "better coverage", "upgrade", "downgrade",
    "something better", "is there a better", "can you suggest",
    "more affordable", "budget friendly", "better value",
]
_YES_RE = re.compile(
    r"^\W*(yes|yeah|yep|yup|ya|sure|ok|okay|please|go ahead|go on|"
    r"aama|seri|sari|show me|tell me|why not|of course|absolutely)\b",
    re.IGNORECASE,
)


def _reads_as_yes(message: str) -> bool:
    """A short reply that opens with an agreement.

    Used only to answer a question the advisor just asked, so it deliberately
    reads the front of the message: "yes please" agrees, while "yes but what
    about my father's condition" is a new question wearing a yes.
    """
    text = (message or "").strip()
    return bool(text) and bool(_YES_RE.match(text)) and len(text.split()) <= 6


_PURCHASE_KW = [
    "buy", "purchase", "proceed", "take this", "select this", "want this",
    "apply", "sign up", "enroll", "get started", "finalize", "confirm",
    "go ahead", "let's do it", "i'll take it", "proceed with",
    "move forward", "yes, this one", "sounds good", "let me buy",
]


# ── Customer profile view ──────────────────────────────────────────────────────

def _first_number(raw: Any) -> Optional[int]:
    """The first whole number `raw` carries, or None if it carries none.

    A profile field holds what the customer typed, not what a form validated:
    "3 per, naan 32 vayasu wife 30 kid 5" is a real answer to "how many
    members?", and int() on it raises. That exception escaped the whole turn,
    so a customer who answered the question in a sentence — the way this
    product asks people to — got "I'm experiencing a brief interruption"
    instead of a recommendation. The number is read out of the text here the
    way every domain engine already reads it.
    """
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    digits = re.findall(r"\d+", str(raw))
    return int(digits[0]) if digits else None

@dataclass
class CustomerProfileView:
    """
    Structured view of customer data for the conversation state machine.
    Maps the flat profile dict to the schema required by the spec:
      { coverageType, memberCount, eldestAge, city, medicalConditions,
        monthlyBudget, recommendationCompleted }
    """
    coverageType:           Optional[str]   = None  # "individual" | "family"
    memberCount:            Optional[int]   = None
    eldestAge:              Optional[int]   = None
    city:                   Optional[str]   = None
    medicalConditions:      Optional[str]   = None  # "none" or description
    monthlyBudget:          Optional[float] = None
    recommendationCompleted: bool           = False

    @classmethod
    def from_profile(
        cls,
        profile: dict,
        has_recommendation: bool = False,
    ) -> "CustomerProfileView":
        members = _first_number(profile.get("family_size"))
        if members == 1:
            coverage = "individual"
        elif members and members > 1:
            coverage = "family"
        else:
            coverage = None
        return cls(
            coverageType            = coverage,
            memberCount             = members,
            eldestAge               = _first_number(profile.get("age")),
            city                    = profile.get("location"),
            medicalConditions       = profile.get("medical_history"),
            # Money, not a count: "15k" is fifteen thousand, and parse_amount
            # is what the rest of the codebase reads rupees with.
            monthlyBudget           = parse_amount(profile.get("budget")),
            recommendationCompleted = has_recommendation,
        )

    def missing_field_labels(self) -> List[str]:
        """Human-readable labels for fields still needed (for structured display)."""
        fields = []
        if not self.memberCount:        fields.append("Who to cover / how many members")
        if not self.eldestAge:          fields.append("Age of eldest member")
        if not self.city:               fields.append("City")
        if not self.monthlyBudget:      fields.append("Monthly budget")
        if not self.medicalConditions:  fields.append("Medical conditions (if any)")
        return fields

    def as_summary(self) -> str:
        """One-line structured summary for LLM prompt context."""
        parts = []
        if self.coverageType:   parts.append(f"Coverage: {self.coverageType}")
        if self.memberCount:    parts.append(f"{self.memberCount} members")
        if self.eldestAge:      parts.append(f"eldest age {self.eldestAge}")
        if self.city:           parts.append(f"city {self.city}")
        if self.monthlyBudget:  parts.append(f"₹{self.monthlyBudget:,.0f}/month budget")
        if self.medicalConditions: parts.append(f"medical: {self.medicalConditions}")
        return ", ".join(parts) if parts else "(no profile data yet)"


# ── Middleware result ──────────────────────────────────────────────────────────

@dataclass
class MiddlewareContext:
    """Result of ConversationMiddleware.analyze() — consumed by _build_workflow_context()."""
    state:             ConversationState
    intent:            ConversationIntent
    profile_view:      CustomerProfileView
    locked:            bool              # Rec is locked — DO NOT regenerate card
    force_compare:     bool              # Generate alternative plan (skip cache)
    existing_rec_summary: Optional[str]  # Brief summary of cached rec (for EXPLAIN mode)
    # Ask whether they want the next-best option — and show nothing this turn.
    # "Is there anything cheaper?" is a question, and answering it by putting
    # the rest of the catalogue on screen is the behaviour this whole flow
    # exists to stop. The customer gets asked; the card waits for the answer.
    offer_alternatives: bool = False


# ── Middleware ─────────────────────────────────────────────────────────────────

class ConversationMiddleware:
    """
    Reusable pre-flight conversation middleware for all Aegis AI specialist agents.

    Usage (in BaseInsuranceAgent.generate_response):
        existing_rec = ...  # cached rec result or None
        pipeline_complete = not bool(missing)
        ctx = self._middleware.analyze(
            message, profile, history, existing_rec, pipeline_complete
        )
        # use ctx.state, ctx.intent, ctx.locked, ctx.force_compare in _build_workflow_context
    """

    def analyze(
        self,
        message: str,
        profile: dict,
        history: List[Dict],
        existing_recommendation: Optional[dict],
        pipeline_complete: bool = False,
        is_pure_router: bool = False,  # True for Executive AI
    ) -> MiddlewareContext:
        """
        Run the full pre-flight analysis for one conversation turn.

        Parameters:
            message:                Current user message
            profile:                Current merged customer profile dict
            history:                Full conversation history [{role, content}, ...]
            existing_recommendation: Cached rec_result from recommendation cache (or None)
            pipeline_complete:      True when _check_missing_details() returns [] (no missing)
            is_pure_router:         True for Executive AI (skip most analysis)
        """
        has_rec = existing_recommendation is not None

        # Build structured profile view
        pv = CustomerProfileView.from_profile(profile, has_recommendation=has_rec)

        # Pure router (Executive AI) — always in qualification/routing mode
        if is_pure_router:
            return MiddlewareContext(
                state=ConversationState.QUALIFICATION,
                intent=ConversationIntent.GENERAL,
                profile_view=pv,
                locked=False,
                force_compare=False,
                existing_rec_summary=None,
            )

        # 1. Detect intent
        intent = self._detect_intent(message)

        # Buy what? Before a plan has been recommended there is nothing to
        # purchase, and the words people use to agree to something — "go
        # ahead", "proceed", "confirm" — are the same words they use to buy.
        # "Yes, please. Go ahead." is how a customer consents to *see* the
        # recommendation, and reading it as a purchase sent them to the
        # payment-steps reply on the one turn the plan was meant to appear.
        if intent == ConversationIntent.PURCHASE and not has_rec:
            intent = ConversationIntent.GENERAL

        # 2. Determine state
        state = self._determine_state(
            profile_view=pv,
            history=history,
            has_recommendation=has_rec,
            pipeline_complete=pipeline_complete,
            intent=intent,
        )

        # 3. Alternatives — offered first, shown second.
        #    An agent records that it offered (profile field `alternative_offered`),
        #    so a customer who then says "yes, go on" gets the alternative even
        #    though that reply carries no compare keyword of its own. If they say
        #    something else instead, the offer simply lapses rather than being
        #    put to them again.
        awaiting_answer    = bool(profile.get("alternative_offered"))
        offer_alternatives = False
        force_compare      = False
        if awaiting_answer:
            force_compare = (
                intent == ConversationIntent.COMPARE or _reads_as_yes(message)
            )
        elif intent == ConversationIntent.COMPARE and has_rec:
            # Alternative to what? Asked before anything has been recommended,
            # "is there something cheaper?" is a question about the market, not
            # a request for the next-best plan — and offering one would abandon
            # a consultation that has not finished asking.
            offer_alternatives = True

        # 4. Recommendation lock:
        #    Lock when rec exists AND state is RECOMMENDATION_PRESENTED
        #    AND this turn is not one that needs a fresh plan. Asking whether
        #    they'd like an alternative is itself a locked turn — the question
        #    is the whole reply, and no new card comes with it.
        locked = (
            has_rec
            and state == ConversationState.RECOMMENDATION_PRESENTED
            and intent != ConversationIntent.PURCHASE
            and not force_compare
        )

        # 5. Build rec summary for EXPLAIN mode
        rec_summary = self._build_rec_summary(existing_recommendation) if has_rec else None

        return MiddlewareContext(
            state=state,
            intent=intent,
            profile_view=pv,
            locked=locked,
            force_compare=force_compare,
            existing_rec_summary=rec_summary,
            offer_alternatives=offer_alternatives,
        )

    # ── Intent detection ──────────────────────────────────────────────────────

    def _detect_intent(self, message: str) -> ConversationIntent:
        msg = message.lower()
        if any(kw in msg for kw in _EXPLAIN_KW):
            return ConversationIntent.EXPLAIN
        if any(kw in msg for kw in _COMPARE_KW):
            return ConversationIntent.COMPARE
        if any(kw in msg for kw in _PURCHASE_KW):
            return ConversationIntent.PURCHASE
        return ConversationIntent.GENERAL

    # ── State determination ───────────────────────────────────────────────────

    def _determine_state(
        self,
        profile_view: CustomerProfileView,
        history: List[Dict],
        has_recommendation: bool,
        pipeline_complete: bool,
        intent: ConversationIntent,
    ) -> ConversationState:

        # Purchase / Compare override any other state
        if intent == ConversationIntent.PURCHASE:
            return ConversationState.PURCHASE

        if intent == ConversationIntent.COMPARE:
            return ConversationState.COMPARISON

        # Recommendation already presented
        if has_recommendation:
            return ConversationState.RECOMMENDATION_PRESENTED

        # Profile complete → ready to generate recommendation
        if pipeline_complete:
            return ConversationState.RECOMMENDATION_ANALYSIS

        # Profile incomplete → determine where in collection we are
        if not history:
            return ConversationState.GREETING

        # Early turns without coverage type → qualification
        if not profile_view.memberCount and len(history) <= 2:
            return ConversationState.QUALIFICATION

        return ConversationState.DATA_COLLECTION

    # ── Rec summary builder ───────────────────────────────────────────────────

    def _build_rec_summary(self, rec: Optional[dict]) -> Optional[str]:
        if not rec or not isinstance(rec, dict):
            return None
        primary = rec.get("primary_recommendation", {})
        if not primary:
            # Try flat structure
            name    = rec.get("planName", rec.get("plan_name", "Selected Plan"))
            premium = rec.get("premium", rec.get("premium_monthly", "?"))
            cover   = rec.get("coverage", rec.get("coverage_limit", "?"))
        else:
            name    = primary.get("plan_name", "Selected Plan")
            premium = primary.get("premium_monthly", "?")
            cover   = primary.get("coverage_limit", "?")

        return f"{name} | ₹{premium}/month | Coverage: {cover}"
