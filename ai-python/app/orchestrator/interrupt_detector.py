"""
Aegis AI — Interrupt Detector

Pre-LLM classifier for MID-WORKFLOW domain-switch signals.
Runs AFTER FIR (explicit "connect me to X" commands) and BEFORE the IDE gate.

Gap this fills:
  FIR needs a trigger phrase + domain keyword and only handles ≤12 words.
  The IDE may be skipped for active workflows (needs_detection() returns False).
  So "actually motor insurance" / "forget this, travel" / "health please" can
  slip through undetected while the user is deep in a different workflow.

Detection criteria (ALL must hold):
  1. Active workflow exists (current_domain is set)
  2. Message ≤ 25 words
  3. Message contains a domain keyword for a DIFFERENT domain
  4. EITHER: message starts with an abandon/redirect signal
             OR: message is ≤ 5 words (pure domain name request)
             OR: message length > 12 (longer than FIR limit — catches its blind spot)

Not detected (handled elsewhere):
  • Explicit "connect me to X" / "switch to X"  → FastIntentRouter
  • Complex domain questions > 25 words          → IntentDetectionEngine
  • Same domain as current workflow               → no interrupt needed
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Optional


# ── Domain vocabulary ─────────────────────────────────────────────────────────

_DOMAIN_KW: Dict[str, List[str]] = {
    "motor": [
        "motor insurance", "motor", "vehicle insurance", "vehicle",
        "car insurance", "car", "bike insurance", "bike",
        "automobile", "two-wheeler", "four-wheeler", "ev insurance", "ev",
        "scooter", "comprehensive motor",
    ],
    "health": [
        "health insurance", "health", "medical insurance", "medical",
        "family floater", "mediclaim", "hospital cover", "hospitaliz",
        "critical illness", "health cover", "family health",
    ],
    "travel": [
        "travel insurance", "travel", "trip insurance", "trip",
        "international insurance", "flight insurance",
        "vacation insurance", "holiday insurance",
        "abroad", "overseas insurance",
    ],
    "home-property": [
        "home insurance", "property insurance", "home", "property",
        "house insurance", "apartment insurance", "flat insurance",
        "contents insurance", "fire insurance", "building insurance",
        "real estate insurance",
    ],
    "executive": [
        "executive insurance", "cyber insurance", "cyber",
        "directors insurance", "corporate insurance",
        "professional liability", "business risk", "d&o",
    ],
}

# Sorted longest-first so regex matches the most specific phrase first
_SORTED_KW: Dict[str, List[str]] = {
    d: sorted(kws, key=len, reverse=True) for d, kws in _DOMAIN_KW.items()
}

# Abandon / redirect signals
_ABANDON: List[str] = [
    "actually", "forget that", "forget this", "forget it",
    "cancel this", "cancel that", "cancel",
    "stop this", "stop that",
    "leave this", "leave that",
    "scratch that", "never mind", "nevermind",
    "change my mind", "changed my mind",
    "instead", "different insurance", "different product",
    "not health", "not motor", "not travel", "not property",
    "rather", "let me reconsider", "reconsider",
    "switch", "move to", "move me to",
]

_AGENT_NAMES: Dict[str, str] = {
    "motor":         "Alex AI",
    "health":        "Sarah AI",
    "travel":        "Ethan AI",
    "home-property": "Emma AI",
    "executive":     "Sri AI",
}

_MAX_WORDS = 25


@dataclass
class InterruptResult:
    detected: bool
    target_domain: str = ""
    target_name: str = ""
    current_domain: str = ""
    confidence: float = 0.0
    reason: str = ""


class InterruptDetector:
    """
    Zero-LLM mid-workflow interrupt classifier.

    Usage in dispatch():
        result = self.interrupt_detector.detect(message, active_agent)
        if result.detected:
            self._save_snapshot(session_id, active_agent, history)
            return self._build_interrupt_suggestion(result, session_id)
    """

    def __init__(self) -> None:
        # Pre-compile domain patterns (longest keyword first for greedy match)
        self._domain_res: Dict[str, re.Pattern] = {
            domain: re.compile(
                r"(?<!\w)(" + "|".join(re.escape(kw) for kw in kws) + r")(?!\w)",
                re.IGNORECASE,
            )
            for domain, kws in _SORTED_KW.items()
        }

        # Abandon keyword pattern (longest phrase first)
        ab_sorted = sorted(_ABANDON, key=len, reverse=True)
        self._abandon_re = re.compile(
            r"(?<!\w)(" + "|".join(re.escape(a) for a in ab_sorted) + r")(?!\w)",
            re.IGNORECASE,
        )

    def detect(
        self,
        message: str,
        current_domain: Optional[str],
    ) -> InterruptResult:
        """
        Detects whether `message` is a mid-workflow signal to switch to a
        different insurance domain. Never calls the LLM. Runs in <1 ms.

        Args:
            message:        Raw user message.
            current_domain: Domain key of the currently active agent.

        Returns:
            InterruptResult(detected=True) if a cross-domain switch is detected.
        """
        if not current_domain:
            return InterruptResult(detected=False)

        stripped = message.strip()
        words = stripped.split()

        if len(words) > _MAX_WORDS:
            return InterruptResult(detected=False)

        msg_lower = stripped.lower()

        has_abandon = bool(self._abandon_re.search(msg_lower))

        # Find the first domain keyword for a domain OTHER than current
        target_domain: Optional[str] = None
        for domain, pattern in self._domain_res.items():
            if domain == current_domain:
                continue
            if pattern.search(msg_lower):
                target_domain = domain
                break

        if target_domain is None:
            return InterruptResult(detected=False)

        word_count = len(words)

        # Require at least one qualifying condition beyond the domain keyword
        if not has_abandon and word_count > 5 and word_count <= 12:
            # Medium-length message, no abandon signal — too ambiguous.
            # FIR already covered trigger+keyword combos in this range.
            # Let IDE handle the remainder.
            return InterruptResult(detected=False)

        # Confidence scoring
        if has_abandon and word_count <= 5:
            confidence = 0.96  # "forget this, travel" — crystal clear
            reason = f"abandon+short_domain({target_domain})"
        elif has_abandon:
            confidence = 0.91  # "actually I think I need motor insurance"
            reason = f"abandon_signal+domain({target_domain})"
        elif word_count <= 5:
            confidence = 0.88  # "motor please" / "travel insurance"
            reason = f"short_domain_only({target_domain}, {word_count}w)"
        else:
            confidence = 0.74  # 13–25 word message with domain keyword
            reason = f"long_domain_mention({target_domain}, {word_count}w)"

        return InterruptResult(
            detected=True,
            target_domain=target_domain,
            target_name=_AGENT_NAMES.get(target_domain, target_domain),
            current_domain=current_domain,
            confidence=confidence,
            reason=reason,
        )
