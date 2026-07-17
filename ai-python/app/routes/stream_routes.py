"""
Aegis AI — SSE Streaming Chat Route
POST /api/ai/chat/stream  →  text/event-stream response
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.services.stream_service import stream_chat

router = APIRouter(tags=["Streaming Chat"])


@router.post(
    "/chat/stream",
    summary="Stream Aegis AI advisor response via Server-Sent Events",
    response_description="text/event-stream of thinking steps + reply tokens",
)
async def stream_chat_endpoint(request: ChatRequest):
    """
    Streams the AI advisor response as SSE events:
      - thinking steps (while the orchestrator processes)
      - agent_info (domain + transfer metadata)
      - token   (word batches of the final reply)
      - done    (completion signal)
      - error   (if something fails)
    """
    history = [m.dict() for m in (request.history or [])]

    generator = stream_chat(
        message=request.message,
        history=history,
        user_name=request.user_name or "Customer",
        product_type=request.product_type,
        session_id=request.session_id or "",
        force_transfer_to=request.force_transfer_to,
        declined_domains=request.declined_domains,
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
        },
    )
