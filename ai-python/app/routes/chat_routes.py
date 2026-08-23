from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.utils.logger import logger

router = APIRouter()

# Lazy-loaded chat service
_chat_service = None


def get_chat_service():
    global _chat_service
    if _chat_service is None:
        from app.services.chat_service import ChatService
        _chat_service = ChatService()
    return _chat_service


def _result_to_response(result: dict) -> ChatResponse:
    """Converts orchestrator dispatch dict to ChatResponse schema."""
    return ChatResponse(
        reply=result.get("reply", ""),
        agent_name=result.get("agent_name"),
        agent_domain=result.get("agent_domain"),
        transferred=result.get("transferred", False),
        suggest_transfer=result.get("suggest_transfer", False),
        is_interrupt=result.get("is_interrupt", False),
        transfer_from=result.get("transfer_from"),
        transfer_from_name=result.get("transfer_from_name"),
        transfer_to=result.get("transfer_to"),
        transfer_to_name=result.get("transfer_to_name"),
        transfer_reason=result.get("transfer_reason"),
        previous_agent=result.get("previous_agent"),
        session_id=result.get("session_id"),
    )


@router.post("/ai-chat", response_model=ChatResponse, summary="Submit query to Aegis AI Advisor")
async def chat_endpoint(request: ChatRequest):
    """Routes message through the multi-agent orchestrator."""
    # Shape only, never content — a customer's message can carry a medical
    # condition, an income or a family situation, and it has no business in a
    # log line that outlives the request. Mirrors the policy `stt_service`
    # already follows for a spoken turn's transcript.
    logger.info(f"[/api/ai/ai-chat] chars={len(request.message)}")
    try:
        service = get_chat_service()
        result = await service.dispatch(
            request.message, request.history, request.user_name,
            request.product_type, request.session_id,
            force_transfer_to=request.force_transfer_to,
            declined_domains=request.declined_domains,
            user_id=request.user_id,
        )
        return _result_to_response(result)
    except Exception as e:
        # Logged in full server-side; the client gets a generic message. The
        # exception text can carry a provider error, a file path, or (for a
        # misconfigured client) the internal key itself — none of that belongs
        # in an HTTP response body.
        logger.error(f"[/api/ai/ai-chat] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error.")


@router.post("", response_model=ChatResponse, summary="Direct backend integration endpoint at /api/ai")
async def direct_integration_endpoint(request: ChatRequest):
    """Backward-compatible endpoint for Node.js backend proxy."""
    # Shape only, never content — see the note on the sibling route above.
    logger.info(f"[/api/ai] chars={len(request.message)}")
    try:
        service = get_chat_service()
        result = await service.dispatch(
            request.message, request.history, request.user_name,
            request.product_type, request.session_id,
            force_transfer_to=request.force_transfer_to,
            declined_domains=request.declined_domains,
            user_id=request.user_id,
        )
        return _result_to_response(result)
    except Exception as e:
        logger.error(f"[/api/ai] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error.")
