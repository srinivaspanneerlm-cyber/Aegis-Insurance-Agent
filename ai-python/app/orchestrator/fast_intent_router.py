"""
Aegis AI — Fast Intent Router (FIR)

Pre-LLM, zero-latency detector for explicit agent transfer commands.
Runs in <1ms using compiled regex + keyword lookup — NO LLM involved.

Detected patterns:
  "connect me to alex"     → motor
  "switch to sarah"        → health
  "talk to ethan"          → travel
  "transfer me to emma"    → home-property
  "go to sri"              → executive
  "open alex"              → motor
  "i want sarah"           → health
  "alex please"            → motor (bare agent name)

Non-transfer messages (returns detected=False):
  "I have a question about health insurance for my family of 4"
  "what does sarah recommend?" (context question, not a switch request)
  "alex said the premium is 500" (reference, not a switch)
"""

import re
from dataclasses import dataclass
from typing import Optional


# ── Transfer trigger phrases ───────────────────────────────────────────────────

_TRIGGERS = [
    "connect me to", "connect me with", "connect to", "connect with",
    "switch me to", "switch to",
    "transfer me to", "transfer to",
    "talk to", "i want to talk to", "i'd like to talk to", "let me talk to",
    "speak to", "speak with", "i want to speak to",
    "take me to", "send me to", "go to",
    "put me through to", "put me through",
    "open", "start", "launch",
    "i want", "i need", "get me",
    "can i talk to", "can you connect me", "can you transfer me",
]

# Sorted longest-first so regex matches the most specific phrase
_TRIGGERS_SORTED = sorted(_TRIGGERS, key=len, reverse=True)

# ── Agent name + domain keyword mapping ───────────────────────────────────────

_AGENT_KEYWORDS: dict[str, list[str]] = {
    "motor":         ["alex", "motor", "vehicle", "car", "bike"],
    "health":        ["sarah", "health", "medical"],
    "travel":        ["ethan", "travel", "trip"],
    "home-property": ["emma", "home", "property", "house"],
    "executive":     ["sri", "executive", "risk"],
}

_AGENT_NAMES: dict[str, str] = {
    "motor":         "Alex AI",
    "health":        "Sarah AI",
    "travel":        "Ethan AI",
    "home-property": "Emma AI",
    "executive":     "Sri AI",
}

# Bare agent first-name patterns (high precision — only the name alone in a short msg)
_BARE_NAME_DOMAINS: dict[str, str] = {
    "alex":  "motor",
    "sarah": "health",
    "ethan": "travel",
    "emma":  "home-property",
    "sri":   "executive",
}

# Max word count for a message to be considered an explicit transfer command.
# Longer messages are likely insurance questions, not switch requests.
_MAX_WORDS = 12


@dataclass
class FastRouterResult:
    detected: bool
    target_domain: str = ""
    target_name:   str = ""
    confidence:    float = 0.0
    reason:        str = ""


class FastIntentRouter:
    """
    Zero-LLM transfer command detector.  Called at the TOP of every dispatch
    before the Intent Detection Engine or any LLM call.

    Returns FastRouterResult(detected=True) only when the message is
    unambiguously requesting an agent switch.
    """

    def __init__(self) -> None:
        # Pre-compile trigger regex (word-boundary aware)
        escaped = [re.escape(t) for t in _TRIGGERS_SORTED]
        self._trigger_re = re.compile(
            r"(?<!\w)(" + "|".join(escaped) + r")(?!\w)",
            re.IGNORECASE,
        )

        # Pre-compile per-domain keyword patterns
        self._domain_res: dict[str, re.Pattern] = {
            domain: re.compile(
                r"(?<!\w)(" + "|".join(re.escape(kw) for kw in kws) + r")(?!\w)",
                re.IGNORECASE,
            )
            for domain, kws in _AGENT_KEYWORDS.items()
        }

    def detect(self, message: str) -> FastRouterResult:
        """
        Analyse `message` and return whether it is an explicit transfer command.
        Never calls the LLM.  Runs in <1 ms.
        """
        stripped = message.strip()
        words    = stripped.split()

        # Quick bail — too long to be a simple transfer command
        if len(words) > _MAX_WORDS:
            return FastRouterResult(detected=False)

        msg_lower = stripped.lower()

        has_trigger = bool(self._trigger_re.search(msg_lower))

        # 1. Trigger + domain keyword → highest confidence
        if has_trigger:
            for domain, pattern in self._domain_res.items():
                if pattern.search(msg_lower):
                    return FastRouterResult(
                        detected=True,
                        target_domain=domain,
                        target_name=_AGENT_NAMES[domain],
                        confidence=0.97,
                        reason="trigger_phrase + agent_keyword",
                    )

        # 2. Bare agent first name alone (e.g. "alex", "sarah please", "hi ethan")
        for name, domain in _BARE_NAME_DOMAINS.items():
            if re.search(r"(?<!\w)" + name + r"(?!\w)", msg_lower, re.IGNORECASE):
                # Only treat as transfer if message is very short (≤4 words)
                # and doesn't look like a reference ("alex said...", "ask alex")
                if len(words) <= 4 and not any(
                    ref in msg_lower for ref in ["said", "says", "told", "asked", "ask", "what", "how", "why"]
                ):
                    return FastRouterResult(
                        detected=True,
                        target_domain=domain,
                        target_name=_AGENT_NAMES[domain],
                        confidence=0.82,
                        reason="bare_agent_name",
                    )

        return FastRouterResult(detected=False)
