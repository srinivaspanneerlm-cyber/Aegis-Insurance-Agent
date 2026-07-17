"""
Aegis AI — Intent Detection Engine (IDE)

ROLE: Understand WHAT the user wants. Nothing else.

RESPONSIBILITIES:
  ✓ Detect primary intent and insurance domain
  ✓ Detect secondary/new domain in multi-domain messages
  ✓ Decide whether to continue current workflow or start new one
  ✓ Calculate multi-signal confidence scores
  ✓ Return structured IntentResult

NOT RESPONSIBLE FOR:
  ✗ Generating text responses
  ✗ Recommending insurance plans
  ✗ Generating UI components
  ✗ Asking insurance questions
  ✗ Verifying documents or payments

WHEN CALLED (gate logic in needs_detection()):
  • New conversation — no active session
  • User explicitly starts a new request
  • User changes insurance domain (with domain change phrase)
  • Workflow completed or cancelled

WHEN SKIPPED:
  • Active session + continuation message (numeric, age, ack, follow-up)
  • Active session + ambiguous short message with no domain signal
  • Active session + question about the same domain as current agent
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from app.utils.logger import logger


# ── Output Models ─────────────────────────────────────────────────────────────

@dataclass
class IntentSignal:
    """
    One detected signal contributing to the final intent decision.
    Used for auditing, debugging, and confidence explanation.
    """
    source: str         # "keyword_match" | "agent_mention" | "domain_change_phrase"
                        # | "continuation_pattern" | "history_context" | "profile_context"
    domain: Optional[str]
    confidence: float   # 0.0 – 1.0
    reason: str

    def to_dict(self) -> Dict:
        return {
            "source": self.source,
            "domain": self.domain,
            "confidence": round(self.confidence, 3),
            "reason": self.reason,
        }


@dataclass
class IntentResult:
    """
    Complete structured output from the Intent Detection Engine.

    The orchestrator reads this to decide:
      - Which agent should handle the message
      - Whether to continue or start a new workflow
      - Whether to ask the customer's permission before transferring

    IDE NEVER generates text, UI, or recommendations.
    """
    # ── Intent classification ──────────────────────────────────────────────
    primary_intent: str              # "Health Insurance", "Motor Insurance", …
    secondary_intent: Optional[str]  # Set when user also mentions a second domain
    domain: str                      # "health", "motor", "travel", "home-property", "executive"
    secondary_domain: Optional[str]  # Domain for secondary intent → triggers transfer ask

    # ── Confidence ─────────────────────────────────────────────────────────
    confidence: float   # 0.0 – 1.0
    reason: str         # Human-readable explanation

    # ── Workflow decision ──────────────────────────────────────────────────
    is_continuation: bool    # True = keep current agent, no routing change
    workflow_action: str     # "continue" | "new_workflow" | "request_transfer"
    next_agent: str          # Domain key of agent that should handle this message

    # ── Current workflow state ─────────────────────────────────────────────
    current_workflow: str    # "Collect Customer Details" | "Recommendation" | …

    # ── Audit trail ───────────────────────────────────────────────────────
    signals: List[IntentSignal] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_intent": self.primary_intent,
            "secondary_intent": self.secondary_intent,
            "domain": self.domain,
            "secondary_domain": self.secondary_domain,
            "confidence": round(self.confidence, 3),
            "confidence_pct": f"{round(self.confidence * 100)}%",
            "reason": self.reason,
            "is_continuation": self.is_continuation,
            "workflow_action": self.workflow_action,
            "next_agent": self.next_agent,
            "current_workflow": self.current_workflow,
            "signals": [s.to_dict() for s in self.signals],
        }


# ── Intent Detection Engine ───────────────────────────────────────────────────

class IntentDetectionEngine:
    """
    Enterprise-grade intent analysis engine.

    Multi-signal pipeline:
      Signal 1: Weighted keyword lexicon scan
      Signal 2: Agent name detection  (highest confidence)
      Signal 3: Domain change phrase detection
      Signal 4: Continuation pattern detection
      Signal 5: Conversation history dominant-domain
      Signal 6: Customer profile context

    Returns IntentResult — NEVER generates text.
    """

    DEFAULT_AGENT = "executive"

    # Confidence thresholds
    STRONG_SIGNAL   = 0.80   # Clear domain — can route confidently
    MEDIUM_SIGNAL   = 0.55   # Probable domain
    TRANSFER_GATE   = 0.68   # Min confidence required to trigger transfer from active session

    # ── Weighted domain lexicon ───────────────────────────────────────────────
    # Format: phrase → weight (0.0–1.0)
    # High weight = specific / unambiguous term (explicit product name)
    # Low weight  = generic term (could appear in many contexts)
    DOMAIN_LEXICON: Dict[str, Dict[str, float]] = {
        "health": {
            # Explicit product names → very high confidence
            "health insurance": 0.95, "medical insurance": 0.95,
            "family floater": 0.92,   "critical illness": 0.90,
            "maternity cover": 0.92,  "cashless hospitalization": 0.90,
            "cashless hospital": 0.88,"room rent sublimit": 0.88,
            "co-payment": 0.85,       "co-pay": 0.82,
            "day care": 0.80,         "senior citizen health": 0.88,
            "group health": 0.85,     "individual health": 0.85,
            "pre-existing": 0.82,     "network hospital": 0.82,
            # Agent name → maximum confidence
            "sarah ai": 1.00,         "sarah": 0.88,
            # Generic terms → medium confidence
            "health": 0.72,           "medical": 0.68,
            "hospital": 0.62,         "doctor": 0.58,
            "surgery": 0.62,          "medicine": 0.56,
            "hospitalization": 0.75,
        },
        "motor": {
            "car insurance": 0.95,    "bike insurance": 0.95,
            "motor insurance": 0.95,  "vehicle insurance": 0.92,
            "two wheeler insurance": 0.92, "two-wheeler insurance": 0.92,
            "zero depreciation": 0.90, "zero dep": 0.88,
            "engine protection": 0.90, "idv": 0.88,
            "ncb": 0.85,              "own damage": 0.85,
            "third party motor": 0.88, "roadside assist": 0.85,
            "cashless garage": 0.85,  "no claim bonus": 0.85,
            "ev insurance": 0.85,     "electric vehicle insurance": 0.88,
            "alex ai": 1.00,          "alex": 0.88,
            # Vehicle model names → high domain confidence
            "creta": 0.82,            "enfield": 0.82,
            "swift": 0.75,            "nexon": 0.80,
            "bolero": 0.78,           "innova": 0.78,
            "activa": 0.80,
            # Generic vehicle terms → medium confidence
            "car": 0.62,              "bike": 0.62,
            "vehicle": 0.60,          "automobile": 0.65,
            "suv": 0.68,              "truck": 0.65,
            "motor": 0.68,            "scooter": 0.72,
            "two-wheeler": 0.80,      "auto": 0.52,
            "hyundai": 0.68,          "garage": 0.58,
        },
        "travel": {
            "travel insurance": 0.95, "trip insurance": 0.95,
            "international travel": 0.92, "visa insurance": 0.90,
            "trip cancellation": 0.90, "baggage loss": 0.88,
            "medical evacuation": 0.90, "schengen insurance": 0.92,
            "study abroad": 0.88,     "business travel insurance": 0.90,
            "adventure sports cover": 0.88, "flight delay": 0.85,
            "travel document": 0.82,
            "ethan ai": 1.00,         "ethan": 0.88,
            # Generic travel terms
            "travel": 0.70,           "trip": 0.62,
            "flight": 0.60,           "abroad": 0.68,
            "international": 0.60,    "visa": 0.68,
            "passport": 0.62,         "baggage": 0.72,
            "evacuation": 0.68,       "medevac": 0.80,
            "schengen": 0.82,         "destination": 0.58,
            "germany": 0.70,          "usa": 0.60,
            "france": 0.65,           "europe": 0.62,
        },
        "home-property": {
            "home insurance": 0.95,   "house insurance": 0.95,
            "property insurance": 0.95, "apartment insurance": 0.92,
            "building insurance": 0.90, "landlord insurance": 0.90,
            "tenant insurance": 0.90,  "contents insurance": 0.88,
            "structure cover": 0.88,  "fire insurance": 0.85,
            "earthquake cover": 0.88, "flood cover": 0.88,
            "natural calamity": 0.85, "theft cover": 0.82,
            "burglary cover": 0.85,   "structural rebuild": 0.88,
            "relocation allowance": 0.85,
            "emma ai": 1.00,          "emma": 0.88,
            # Generic property terms
            "home": 0.60,             "house": 0.60,
            "property": 0.60,         "apartment": 0.62,
            "flat": 0.58,             "villa": 0.65,
            "building": 0.56,         "landlord": 0.78,
            "tenant": 0.72,           "rented": 0.60,
        },
        "executive": {
            "corporate insurance": 0.92, "business insurance": 0.90,
            "d&o": 0.95,              "directors and officers": 0.95,
            "cyber liability": 0.92,  "officers liability": 0.90,
            "group corporate health": 0.88, "compliance": 0.72,
            "governance": 0.72,       "business risk": 0.78,
            "escalation": 0.75,       "enterprise insurance": 0.90,
            "board level": 0.82,      "underwriting approval": 0.80,
            "sri ai": 1.00,           "executive": 0.68,
            "corporate": 0.68,
        },
    }

    # ── Domain change trigger phrases ─────────────────────────────────────────
    # These phrases indicate the user is ADDING or SWITCHING to a new domain
    _DOMAIN_CHANGE_RE = re.compile(
        r"\b("
        r"i\s+also\s+need|i\s+also\s+want|additionally\s+i\s+need|"
        r"i\s+(?:want\s+to\s+)?switch\s+to|"
        r"let'?s\s+(?:talk\s+about|move\s+to|switch\s+to)|"
        r"what\s+about\s+(?:my\s+)?(?:car|bike|health|home|travel|motor|property)\s+insurance|"
        r"can\s+you\s+(?:also\s+)?(?:help|advise)\s+(?:me\s+)?(?:with|on)|"
        r"now\s+i\s+(?:also\s+)?need|now\s+i\s+want|"
        r"apart\s+from\s+(?:this|health|motor|travel|home|property)|"
        r"besides\s+(?:this|health|motor|travel|home|property)|"
        r"in\s+addition\s+to\s+(?:this|health|motor|travel|home)|"
        r"i\s+(?:also\s+)?(?:have|own)\s+a\s+(?:car|bike|house|flat|property)"
        r")\b",
        re.IGNORECASE,
    )

    # ── Pure continuation patterns (NEVER trigger intent detection) ────────────
    # These messages are always follow-ups to the current workflow
    _CONTINUATION_RE = re.compile(
        r"^("
        r"yes|no|ok|okay|sure|thanks|thank\s+you|got\s+it|understood|"
        r"perfect|great|nice|good|alright|fine|correct|right|exactly|"
        r"tell\s+me\s+more|show\s+me|compare|continue|proceed|go\s+ahead|"
        r"that'?s\s+(?:fine|good|correct|right|perfect)|sounds\s+good|"
        r"what'?s\s+next|more\s+details|view\s+details|"
        r"select\s+(?:plan|this|that)|buy\s+this|purchase|confirm|"
        r"next|back|done|submit|i\s+see|i\s+understand|makes\s+sense|"
        r"how\s+much|what\s+(?:is|are)\s+the|which\s+(?:plan|option)|"
        r"can\s+you\s+(?:explain|clarify|tell)|please\s+(?:explain|tell|show)|"
        r"what\s+does\s+that\s+mean|please\s+go\s+on"
        r")[\s!.?,]*$",
        re.IGNORECASE,
    )

    # ── Pure numeric / budget messages → always continuation ─────────────────
    _NUMERIC_RE = re.compile(
        r"^[\d\s,₹$\.]+(?:per\s+(?:month|year|annum|pa|mo))?[\s!.?,]*$",
        re.IGNORECASE,
    )

    # ── Age-only messages → always continuation ───────────────────────────────
    _AGE_RE = re.compile(
        r"^(?:i\s+am\s+|my\s+age\s+(?:is\s+)?|age\s+(?:is\s+)?|i'?m\s+)?(\d{1,3})\s*"
        r"(?:years?\s*(?:old)?)?[\s!.?,]*$",
        re.IGNORECASE,
    )

    # ── Greeting pattern ──────────────────────────────────────────────────────
    _GREETING_RE = re.compile(
        r"^("
        r"hi+|hello+|hey+|howdy|good\s+(?:morning|afternoon|evening|day)|"
        r"how\s+are\s+you|who\s+are\s+you|what\s+is\s+this|testing|test|"
        r"start|begin|namaste|greetings"
        r")[\s!.?,]*$",
        re.IGNORECASE,
    )

    # ── Human-readable display maps ───────────────────────────────────────────
    _DOMAIN_TO_INTENT: Dict[str, str] = {
        "health":        "Health Insurance",
        "motor":         "Motor Insurance",
        "travel":        "Travel Insurance",
        "home-property": "Home & Property Insurance",
        "executive":     "Corporate & Executive Insurance",
    }
    _DOMAIN_TO_AGENT: Dict[str, str] = {
        "health":        "Sarah AI",
        "motor":         "Alex AI",
        "travel":        "Ethan AI",
        "home-property": "Emma AI",
        "executive":     "Sri AI",
    }
    _WORKFLOW_STAGES: Dict[str, str] = {
        "initial":        "Collect Customer Details",
        "consultation":   "Collect Customer Details",
        "recommendation": "Generate Recommendation",
        "selection":      "Plan Selection",
        "purchase":       "Purchase & Onboarding",
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════════════════

    def needs_detection(
        self,
        active_agent: Optional[str],
        message: str,
        initial_domain: Optional[str],
        workflow_status: str,
    ) -> bool:
        """
        GATE FUNCTION — Should we run intent detection for this message?

        Returns False (skip detection) when:
          • Active session + message is a clear continuation
          • Active session + no strong signal for a different domain

        Returns True (run detection) when:
          • No active session (new conversation)
          • Bot page explicitly changed (initial_domain ≠ active_agent)
          • Workflow completed or cancelled
          • Explicit domain change phrase + strong other-domain signal
        """
        msg_lower = message.lower().strip()

        # ── Rule 1: No active session → must detect ───────────────────────────
        if not active_agent:
            logger.debug("[IDE:gate] No active session → run detection")
            return True

        # ── Rule 2: Workflow ended → start fresh ──────────────────────────────
        if workflow_status in ("completed", "cancelled"):
            logger.debug(f"[IDE:gate] Workflow {workflow_status} → run detection")
            return True

        # ── Rule 3: Bot page explicitly changed → new workflow ────────────────
        if initial_domain and initial_domain != active_agent:
            logger.debug(
                f"[IDE:gate] Bot page changed: {active_agent} → {initial_domain} → run detection"
            )
            return True

        # ── Rule 4: Pure continuation signals → SKIP detection ───────────────
        if self._is_pure_continuation(msg_lower, active_agent):
            logger.debug("[IDE:gate] Pure continuation detected → skip detection")
            return False

        # ── Rule 5: Check for explicit domain change phrase ───────────────────
        if self._DOMAIN_CHANGE_RE.search(message):
            # Domain change phrase present — check if another domain has strong signal
            domain_scores = self._score_domains(msg_lower)
            other_scores = {d: s for d, s in domain_scores.items() if d != active_agent}
            if other_scores and max(other_scores.values()) >= self.TRANSFER_GATE:
                logger.debug("[IDE:gate] Domain change phrase + strong other-domain signal → run detection")
                return True
            # Phrase present but no strong domain signal → treat as continuation
            logger.debug("[IDE:gate] Domain change phrase but no strong domain signal → skip")
            return False

        # ── Rule 6: Short ambiguous message → SKIP ────────────────────────────
        words = msg_lower.split()
        if len(words) <= 5:
            domain_scores = self._score_domains(msg_lower)
            other_scores = {d: s for d, s in domain_scores.items() if d != active_agent}
            max_other = max(other_scores.values()) if other_scores else 0.0
            if max_other < self.TRANSFER_GATE:
                logger.debug(f"[IDE:gate] Short message, max other-domain score={max_other:.2f} < {self.TRANSFER_GATE} → skip")
                return False

        # ── Default: skip (trust the active session) ──────────────────────────
        logger.debug("[IDE:gate] Default → skip detection, continue current workflow")
        return False

    def analyze(
        self,
        message: str,
        active_agent: Optional[str] = None,
        history: Optional[List[Dict]] = None,
        profile: Optional[Dict] = None,
        initial_domain: Optional[str] = None,
        workflow_status: str = "active",
        workflow_stage: str = "initial",
    ) -> IntentResult:
        """
        Full 10-step intent analysis pipeline.

        Step 1:  Read conversation history
        Step 2:  Read current workflow
        Step 3:  Read customer profile
        Step 4:  Analyze current message
        Step 5:  Identify primary intent
        Step 6:  Identify secondary intent
        Step 7:  Calculate confidence
        Step 8:  Identify insurance domain
        Step 9:  Determine agent continuation vs transfer
        Step 10: Return IntentResult

        This method is ANALYSIS ONLY — never generates text.
        """
        msg_lower = message.lower().strip()
        signals: List[IntentSignal] = []

        # ── Step 1: Read conversation history ─────────────────────────────────
        history_domain, history_conf = self._read_history_context(history or [])
        if history_domain:
            signals.append(IntentSignal(
                source="history_context",
                domain=history_domain,
                confidence=history_conf,
                reason=(
                    f"Conversation history shows dominant {history_domain} domain "
                    f"(conf={history_conf:.0%})"
                ),
            ))

        # ── Step 2: Read current workflow ─────────────────────────────────────
        current_workflow_label = self._WORKFLOW_STAGES.get(workflow_stage, "Collect Customer Details")

        # ── Step 3: Read customer profile ─────────────────────────────────────
        profile_domain, profile_conf = self._read_profile_context(profile or {})
        if profile_domain:
            signals.append(IntentSignal(
                source="profile_context",
                domain=profile_domain,
                confidence=profile_conf,
                reason=f"Customer profile contains {profile_domain}-domain data",
            ))

        # ── Step 4: Analyze latest message ────────────────────────────────────
        is_greeting       = bool(self._GREETING_RE.match(message.strip()))
        is_continuation   = self._is_pure_continuation(msg_lower, active_agent)
        has_domain_change = bool(self._DOMAIN_CHANGE_RE.search(message))

        if is_continuation:
            signals.append(IntentSignal(
                source="continuation_pattern",
                domain=active_agent,
                confidence=0.92,
                reason="Message matches continuation pattern (ack / numeric / age / follow-up)",
            ))
        if has_domain_change:
            signals.append(IntentSignal(
                source="domain_change_phrase",
                domain=None,
                confidence=0.88,
                reason="Explicit domain change phrase detected",
            ))

        # ── Step 5: Keyword scoring → primary domain candidate ────────────────
        domain_scores = self._score_domains(msg_lower)
        for dom, score in sorted(domain_scores.items(), key=lambda x: x[1], reverse=True):
            if score >= 0.40:
                is_agent_mention = self._is_agent_mention(dom, msg_lower)
                signals.append(IntentSignal(
                    source="agent_mention" if is_agent_mention else "keyword_match",
                    domain=dom,
                    confidence=score,
                    reason=(
                        f"Agent name '{self._DOMAIN_TO_AGENT.get(dom, dom)}' explicitly mentioned"
                        if is_agent_mention
                        else f"Keyword evidence for {dom} domain (score={score:.2f})"
                    ),
                ))

        # ── Step 6: Identify secondary intent (domain change) ─────────────────
        secondary_domain: Optional[str] = None
        secondary_intent: Optional[str] = None
        if has_domain_change and active_agent and domain_scores:
            other_scores = {d: s for d, s in domain_scores.items() if d != active_agent}
            if other_scores:
                sec = max(other_scores, key=lambda d: other_scores[d])
                if other_scores[sec] >= self.MEDIUM_SIGNAL:
                    secondary_domain = sec
                    secondary_intent = self._domain_to_intent(sec)

        # ── Step 7: Calculate confidence ─────────────────────────────────────
        top_domain, top_conf = self._calculate_confidence(
            domain_scores=domain_scores,
            history_domain=history_domain,
            history_conf=history_conf,
            profile_domain=profile_domain,
            profile_conf=profile_conf,
            active_agent=active_agent,
            is_greeting=is_greeting,
            is_continuation=is_continuation,
        )

        # ── Step 8: Identify final insurance domain ───────────────────────────
        # Handle greeting → use initial_domain or active_agent or default
        if is_greeting:
            final_domain = initial_domain or active_agent or self.DEFAULT_AGENT
            return IntentResult(
                primary_intent=self._domain_to_intent(final_domain),
                secondary_intent=None,
                domain=final_domain,
                secondary_domain=None,
                confidence=0.88,
                reason=(
                    f"Greeting — routing to "
                    f"{self._DOMAIN_TO_AGENT.get(final_domain, final_domain)}"
                ),
                is_continuation=bool(active_agent),
                workflow_action="continue" if active_agent else "new_workflow",
                next_agent=final_domain,
                current_workflow=current_workflow_label,
                signals=signals,
            )

        # Handle pure continuation → keep current agent
        if is_continuation and active_agent:
            return IntentResult(
                primary_intent=self._domain_to_intent(active_agent),
                secondary_intent=None,
                domain=active_agent,
                secondary_domain=None,
                confidence=0.92,
                reason=(
                    f"Continuation of "
                    f"{self._DOMAIN_TO_AGENT.get(active_agent, active_agent)} workflow — "
                    "no domain change signal"
                ),
                is_continuation=True,
                workflow_action="continue",
                next_agent=active_agent,
                current_workflow=current_workflow_label,
                signals=signals,
            )

        # ── Step 9: Determine workflow action ─────────────────────────────────
        workflow_action, next_agent, is_cont = self._decide_workflow_action(
            top_domain=top_domain,
            top_conf=top_conf,
            active_agent=active_agent,
            initial_domain=initial_domain,
            workflow_status=workflow_status,
            has_domain_change=has_domain_change,
            secondary_domain=secondary_domain,
        )

        # ── Step 10: Build and return IntentResult ───────────────────────────
        reason = self._build_reason(
            workflow_action=workflow_action,
            next_agent=next_agent,
            active_agent=active_agent,
            top_domain=top_domain,
            top_conf=top_conf,
            has_domain_change=has_domain_change,
            secondary_domain=secondary_domain,
        )

        result = IntentResult(
            primary_intent=self._domain_to_intent(next_agent),
            secondary_intent=secondary_intent,
            domain=next_agent,
            secondary_domain=secondary_domain,
            confidence=top_conf if not is_cont else 0.92,
            reason=reason,
            is_continuation=is_cont,
            workflow_action=workflow_action,
            next_agent=next_agent,
            current_workflow=current_workflow_label,
            signals=signals,
        )

        logger.info(
            f"[IDE] intent={result.primary_intent}, "
            f"domain={result.domain}, "
            f"conf={result.confidence:.0%}, "
            f"action={result.workflow_action}, "
            f"agent={result.next_agent}"
        )
        return result

    # ═══════════════════════════════════════════════════════════════════════════
    # PRIVATE: Signal analysis
    # ═══════════════════════════════════════════════════════════════════════════

    def _compiled_lexicon(self) -> Dict[str, List[Tuple[Any, float]]]:
        """
        Lexicon phrases compiled to word-boundary patterns, cached on the class.

        Plain substring matching let a short keyword fire from inside an
        unrelated word — "cardiac" scored motor via "car", "inflation" scored
        home via "flat" — which could misroute a cold-start conversation on the
        keyword tie. Anchoring each phrase with \\b matches it only as a whole
        word (or whole multi-word phrase) instead.
        """
        cache = type(self).__dict__.get("_LEXICON_RE")
        if cache is None:
            cache = {
                domain: [
                    (re.compile(rf"\b{re.escape(phrase)}\b", re.IGNORECASE), weight)
                    for phrase, weight in lexicon.items()
                ]
                for domain, lexicon in self.DOMAIN_LEXICON.items()
            }
            type(self)._LEXICON_RE = cache
        return cache

    def _score_domains(self, msg_lower: str) -> Dict[str, float]:
        """
        Score each domain using weighted keyword matching.
        Multi-keyword matches get a confidence boost.
        Returns domain → confidence (0.0–1.0).
        """
        scores: Dict[str, float] = {}
        for domain, patterns in self._compiled_lexicon().items():
            best_score = 0.0
            match_count = 0
            for pattern, weight in patterns:
                if pattern.search(msg_lower):
                    best_score = max(best_score, weight)
                    match_count += 1

            if best_score > 0:
                # Multi-match boost: 2 matches → +8%, 3+ → +15%
                if match_count >= 3:
                    best_score = min(best_score * 1.15, 1.0)
                elif match_count == 2:
                    best_score = min(best_score * 1.08, 1.0)
                scores[domain] = round(best_score, 3)

        return scores

    def _is_agent_mention(self, domain: str, msg_lower: str) -> bool:
        """Check if the user mentioned the agent by name (highest confidence signal)."""
        agent_phrases = {
            "health":        ["sarah ai", "sarah"],
            "motor":         ["alex ai", "alex"],
            "travel":        ["ethan ai", "ethan"],
            "home-property": ["emma ai", "emma"],
            "executive":     ["sri ai", "executive ai"],
        }
        return any(phrase in msg_lower for phrase in agent_phrases.get(domain, []))

    def _is_pure_continuation(self, msg_lower: str, active_agent: Optional[str]) -> bool:
        """
        Returns True if the message is clearly a follow-up to the current workflow.
        Pure continuations NEVER trigger intent detection.
        """
        if not active_agent:
            return False

        # Explicit acknowledgment / follow-up phrase
        if self._CONTINUATION_RE.match(msg_lower):
            return True

        # Pure numeric (budget, premium, amount)
        if self._NUMERIC_RE.match(msg_lower):
            return True

        # Age-only message
        if self._AGE_RE.match(msg_lower):
            return True

        # Very short (1–3 words), no strong other-domain signal
        words = msg_lower.split()
        if len(words) <= 3:
            domain_scores = self._score_domains(msg_lower)
            other = {d: s for d, s in domain_scores.items() if d != active_agent}
            if not other or max(other.values()) < 0.60:
                return True

        return False

    def _read_history_context(
        self, history: List[Dict]
    ) -> Tuple[Optional[str], float]:
        """
        Scan recent conversation history to find the dominant domain discussed.
        Uses only the last 8 turns.
        Returns (dominant_domain, confidence) or (None, 0.0).
        """
        if not history:
            return None, 0.0

        recent = history[-8:]
        domain_counts: Dict[str, int] = {}

        for turn in recent:
            content = turn.get("content") or turn.get("message") or ""
            if not content:
                continue
            scores = self._score_domains(content.lower())
            if scores:
                top = max(scores, key=lambda d: scores[d])
                if scores[top] >= 0.55:
                    domain_counts[top] = domain_counts.get(top, 0) + 1

        if not domain_counts:
            return None, 0.0

        dominant = max(domain_counts, key=lambda d: domain_counts[d])
        total_turns = len(recent)
        # Cap history signal at 0.50 — it's contextual, not definitive
        confidence = min(0.20 + (domain_counts[dominant] / total_turns) * 0.45, 0.50)
        return dominant, round(confidence, 3)

    def _read_profile_context(
        self, profile: Dict
    ) -> Tuple[Optional[str], float]:
        """
        Infer likely domain from customer profile fields.
        Profile context is a weak supporting signal — capped at 0.30.
        Returns (domain, confidence) or (None, 0.0).
        """
        if not profile:
            return None, 0.0

        hints: Dict[str, float] = {}
        if profile.get("vehicle"):
            hints["motor"] = 0.30
        if profile.get("travel_plans") or profile.get("destination"):
            hints["travel"] = 0.30
        if profile.get("property"):
            hints["home-property"] = 0.30
        if profile.get("age") or profile.get("family_size"):
            hints["health"] = 0.20

        if not hints:
            return None, 0.0

        top = max(hints, key=lambda d: hints[d])
        return top, hints[top]

    def _calculate_confidence(
        self,
        domain_scores: Dict[str, float],
        history_domain: Optional[str],
        history_conf: float,
        profile_domain: Optional[str],
        profile_conf: float,
        active_agent: Optional[str],
        is_greeting: bool,
        is_continuation: bool,
    ) -> Tuple[str, float]:
        """
        Combines keyword scores with contextual signals into a final (domain, confidence).

        Weighting:
          Keyword match:    0.60
          History context:  0.25
          Profile context:  0.10
          Active agent:     0.05 (slight inertia — prefer current if ambiguous)
        """
        if not domain_scores:
            # No keyword signal — fall back to context
            if active_agent:
                return active_agent, 0.45
            if history_domain:
                return history_domain, history_conf
            return self.DEFAULT_AGENT, 0.30

        # Top keyword domain
        top_kw = max(domain_scores, key=lambda d: domain_scores[d])
        top_kw_score = domain_scores[top_kw]

        # Weighted combination
        combined = top_kw_score * 0.60

        if history_domain == top_kw:
            combined += history_conf * 0.25
        elif history_domain:
            combined -= history_conf * 0.10  # slight penalty for mismatch

        if profile_domain == top_kw:
            combined += profile_conf * 0.10

        if active_agent == top_kw:
            combined += 0.05  # tiny inertia toward current agent

        final_conf = round(min(max(combined, 0.0), 1.0), 3)
        return top_kw, final_conf

    def _decide_workflow_action(
        self,
        top_domain: str,
        top_conf: float,
        active_agent: Optional[str],
        initial_domain: Optional[str],
        workflow_status: str,
        has_domain_change: bool,
        secondary_domain: Optional[str],
    ) -> Tuple[str, str, bool]:
        """
        Step 9: Decide the workflow action.
        Returns (workflow_action, next_agent, is_continuation).

        workflow_action values:
          "continue"         — keep current agent, no routing change
          "new_workflow"     — assign new agent, create workflow
          "request_transfer" — ask customer permission before switching
        """
        # No active session → new workflow
        if not active_agent:
            target = initial_domain or top_domain or self.DEFAULT_AGENT
            return "new_workflow", target, False

        # Bot page changed → new workflow for that page
        if initial_domain and initial_domain != active_agent:
            return "new_workflow", initial_domain, False

        # Workflow finished → start fresh
        if workflow_status in ("completed", "cancelled"):
            target = initial_domain or top_domain or self.DEFAULT_AGENT
            return "new_workflow", target, False

        # Explicit domain change requested (secondary intent with change phrase)
        if secondary_domain and has_domain_change:
            return "request_transfer", secondary_domain, False

        # Strong signal for DIFFERENT domain + explicit change phrase
        if (
            top_domain != active_agent
            and top_conf >= self.TRANSFER_GATE
            and has_domain_change
        ):
            return "request_transfer", top_domain, False

        # Same domain as active agent OR ambiguous → continue
        return "continue", active_agent, True

    def _build_reason(
        self,
        workflow_action: str,
        next_agent: str,
        active_agent: Optional[str],
        top_domain: str,
        top_conf: float,
        has_domain_change: bool,
        secondary_domain: Optional[str],
    ) -> str:
        agent_name = self._DOMAIN_TO_AGENT.get(next_agent, next_agent)
        if workflow_action == "continue":
            prev = self._DOMAIN_TO_AGENT.get(active_agent or next_agent, next_agent)
            return f"Continuing {prev} workflow — no domain change detected"
        if workflow_action == "new_workflow":
            return (
                f"New {self._domain_to_intent(next_agent)} workflow — "
                f"{agent_name} assigned (confidence {top_conf:.0%})"
            )
        if workflow_action == "request_transfer":
            sec = self._DOMAIN_TO_AGENT.get(secondary_domain or top_domain, next_agent)
            return (
                f"Customer mentioned {self._domain_to_intent(secondary_domain or top_domain)} "
                f"— asking permission to connect to {sec} (confidence {top_conf:.0%})"
            )
        return f"Routed to {agent_name}"

    def _domain_to_intent(self, domain: Optional[str]) -> str:
        return self._DOMAIN_TO_INTENT.get(domain or self.DEFAULT_AGENT, "General Insurance Query")
