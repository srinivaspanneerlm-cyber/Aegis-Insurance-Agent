from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.utils.logger import logger

router = APIRouter()

# Lazy-loaded chat service (initialized on first request to avoid startup failures)
_chat_service = None

def get_chat_service():
    """Lazy initialization of ChatService to prevent startup failures if no API key."""
    global _chat_service
    if _chat_service is None:
        from app.services.chat_service import ChatService
        _chat_service = ChatService()
    return _chat_service


@router.post("/ai-chat", response_model=ChatResponse, summary="Submit query to Aegis AI Advisor")
async def chat_endpoint(request: ChatRequest):
    """
    Submits user query directly, runs prompt orchestration, and answers with custom financial protection advice.
    """
    logger.info(f"Received request on POST /api/ai/ai-chat: '{request.message[:60]}...'")
    try:
        service = get_chat_service()
        reply = await service.generate_response(request.message, request.history, request.user_name, request.product_type)
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.error(f"Failed to process chat query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred while generating the advice: {str(e)}"
        )


@router.post("", response_model=ChatResponse, summary="Direct backend integration endpoint mapped to /api/ai")
async def direct_integration_endpoint(request: ChatRequest):
    """
    Direct endpoint mapped to prefix /api/ai for backward compatibility with Node.js backend.
    """
    logger.info(f"Received request on direct integration POST /api/ai: '{request.message[:60]}...'")
    try:
        service = get_chat_service()
        reply = await service.generate_response(request.message, request.history, request.user_name, request.product_type)
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.error(f"Failed to process direct chat query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred while generating the advice: {str(e)}"
        )

