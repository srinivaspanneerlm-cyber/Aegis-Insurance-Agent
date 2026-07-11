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
    logger.info(f"[/api/ai/ai-chat] '{request.message[:60]}...'")
    try:
        service = get_chat_service()
        result = await service.dispatch(
            request.message, request.history, request.user_name,
            request.product_type, request.session_id,
            force_transfer_to=request.force_transfer_to,
        )
        return _result_to_response(result)
    except Exception as e:
        logger.error(f"[/api/ai/ai-chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ChatResponse, summary="Direct backend integration endpoint at /api/ai")
async def direct_integration_endpoint(request: ChatRequest):
    """Backward-compatible endpoint for Node.js backend proxy."""
    logger.info(f"[/api/ai] '{request.message[:60]}...'")
    try:
        service = get_chat_service()
        result = await service.dispatch(
            request.message, request.history, request.user_name,
            request.product_type, request.session_id,
            force_transfer_to=request.force_transfer_to,
        )
        return _result_to_response(result)
    except Exception as e:
        logger.error(f"[/api/ai] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
