"""
Aegis AI — SSE Streaming Service
Runs the orchestrator in parallel with animated thinking steps, then streams the
reply word-by-word so the frontend can render token-by-token output.

SSE event types:
  { type: "thinking",   step: str, label: str }
  { type: "agent_info", agent_name, agent_domain, transferred, transfer_from,
                        transfer_to, transfer_to_name, session_id }
  { type: "token",      text: str }
  { type: "done",       session_id: str }
  { type: "error",      message: str }
"""

import asyncio
import json
from typing import AsyncGenerator, Dict, List, Optional, Any

from app.orchestrator.central_orchestrator import CentralOrchestrator
from app.utils.logger import logger

# ─── Singleton orchestrator (shared session state via SessionManager class var) ──
_orchestrator = CentralOrchestrator()

# ─── Domain-aware thinking step sequences ────────────────────────────────────────
THINKING_STEPS: Dict[str, List[tuple]] = {
    "health": [
        ("intent",    "Understanding your health insurance needs..."),
        ("profile",   "Reviewing your family profile..."),
        ("options",   "Finding the best health plans for you..."),
        ("premium",   "Calculating the right premium range..."),
        ("rec",       "Preparing your personalized recommendation..."),
    ],
    "motor": [
        ("intent",   "Understanding your vehicle insurance needs..."),
        ("vehicle",  "Reviewing vehicle details..."),
        ("idv",      "Calculating Insured Declared Value..."),
        ("options",  "Finding the best motor cover for you..."),
        ("rec",      "Building your personalized motor quote..."),
    ],
    "travel": [
        ("intent",      "Understanding your travel needs..."),
        ("destination", "Analyzing destination requirements..."),
        ("options",     "Finding the right travel protection plan..."),
        ("rec",         "Preparing your travel cover recommendation..."),
    ],
    "home-property": [
        ("intent",    "Understanding your property insurance needs..."),
        ("property",  "Reviewing your property details..."),
        ("options",   "Finding the best property cover for you..."),
        ("rec",       "Preparing your property protection plan..."),
    ],
    "executive": [
        ("intent",  "Understanding what you're looking for..."),
        ("match",   "Matching you with the right specialist..."),
        ("connect", "Getting ready to connect you..."),
    ],
}

DEFAULT_THINKING = [
    ("intent",    "Understanding your request..."),
    ("category",  "Identifying the right insurance category..."),
    ("agent",     "Selecting the right specialist advisor..."),
    ("memory",    "Reviewing your conversation history..."),
    ("options",   "Finding relevant coverage options..."),
    ("rec",       "Preparing your recommendation..."),
]

# How long each thinking step stays visible (seconds)
_STEP_DURATION = 0.30


def _quick_domain(message: str, product_type: Optional[str]) -> str:
    """Lightweight domain detector used to pick the right thinking-step sequence."""
    if product_type and product_type in THINKING_STEPS:
        return product_type
    msg = message.lower()
    if any(k in msg for k in ["car", "bike", "vehicle", "motor", "idv", "auto", "creta", "enfield"]):
        return "motor"
    if any(k in msg for k in ["travel", "trip", "flight", "abroad", "international", "visa", "passport"]):
        return "travel"
    if any(k in msg for k in ["home", "house", "property", "apartment", "building", "flat", "landlord"]):
        return "home-property"
    if any(k in msg for k in ["corporate", "business", "enterprise", "d&o", "directors", "liability"]):
        return "executive"
    return "health"


async def stream_chat(
    message: str,
    history: List[Dict[str, Any]],
    user_name: str,
    product_type: Optional[str],
    session_id: str,
    force_transfer_to: Optional[str] = None,
    skip_interrupt: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Main SSE generator — yields thinking steps while the orchestrator processes,
    then streams the reply token-by-token.
    """
    domain = _quick_domain(message, product_type)
    steps = THINKING_STEPS.get(domain, DEFAULT_THINKING)

    # ── Phase 1: Start orchestrator in background immediately ────────────────
    orch_task: asyncio.Task = asyncio.create_task(
        _orchestrator.dispatch(
            message=message,
            history=history,
            user_name=user_name,
            session_id=session_id,
            force_transfer_to=force_transfer_to,
            initial_domain=product_type,
            skip_interrupt=skip_interrupt,
        )
    )

    # ── Phase 2: Emit thinking steps while orchestrator runs ─────────────────
    for step_id, step_label in steps:
        if orch_task.done():
            break
        yield f"data: {json.dumps({'type': 'thinking', 'step': step_id, 'label': step_label})}\n\n"
        try:
            await asyncio.wait_for(asyncio.shield(orch_task), timeout=_STEP_DURATION)
            break  # orchestrator finished before step timer expired
        except asyncio.TimeoutError:
            pass
        except (asyncio.CancelledError, Exception):
            break

    # ── Phase 3: Collect orchestrator result ──────────────────────────────────
    try:
        result: Dict[str, Any] = await orch_task
    except Exception as exc:
        logger.error(f"[StreamService] Orchestrator error: {exc}")
        fallback = (
            "I encountered an unexpected issue while preparing your recommendation. "
            "Could you please rephrase your question or provide a bit more detail? "
            "I'm here to help."
        )
        yield f"data: {json.dumps({'type': 'error', 'message': fallback})}\n\n"
        return

    reply: str          = result.get("reply", "")
    agent_name: str     = result.get("agent_name", "Sarah AI")
    agent_domain: str   = result.get("agent_domain", domain)
    transferred: bool   = result.get("transferred", False)
    suggest_transfer: bool = result.get("suggest_transfer", False)
    out_session_id: str = result.get("session_id", session_id)

    # ── Phase 4: Emit agent metadata (signals frontend: thinking → streaming) ─
    agent_info_payload = {
        "type":               "agent_info",
        "agent_name":         agent_name,
        "agent_domain":       agent_domain,
        "transferred":        transferred,
        "suggest_transfer":   suggest_transfer,
        "is_interrupt":       result.get("is_interrupt", False),
        "transfer_from":      result.get("transfer_from"),
        "transfer_from_name": result.get("transfer_from_name"),
        "transfer_to":        result.get("transfer_to"),
        "transfer_to_name":   result.get("transfer_to_name"),
        "transfer_reason":    result.get("transfer_reason"),
        "previous_agent":     result.get("previous_agent"),
        "session_id":         out_session_id,
    }
    yield f"data: {json.dumps(agent_info_payload)}\n\n"

    # ── Phase 5: Stream reply in word-batches for smooth rendering ────────────
    if reply:
        words = reply.split(" ")
        batch_size = 2  # 2 words per frame ≈ natural reading pace
        for i in range(0, len(words), batch_size):
            chunk = " ".join(words[i : i + batch_size])
            if i + batch_size < len(words):
                chunk += " "
            yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
            await asyncio.sleep(0.025)

    # ── Phase 6: Done signal ──────────────────────────────────────────────────
    yield f"data: {json.dumps({'type': 'done', 'session_id': out_session_id})}\n\n"
