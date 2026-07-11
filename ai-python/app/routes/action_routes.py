from fastapi import APIRouter, HTTPException
from app.models.schemas import UIActionRequest, UIActionResponse
from app.utils.logger import logger

router = APIRouter()

_dispatcher = None


def get_dispatcher():
    global _dispatcher
    if _dispatcher is None:
        from app.services.ui_action_engine import UIActionDispatcher
        _dispatcher = UIActionDispatcher()
    return _dispatcher


@router.post(
    "/action",
    response_model=UIActionResponse,
    summary="UI Action Engine — structured button-click handler (bypasses chat routing)",
    tags=["UI Action Engine"],
)
async def ui_action_endpoint(request: UIActionRequest):
    """
    Receives structured UI action events from the frontend.
    Never executes Intent Detection, Category Routing, or Recommendation Generation.
    """
    logger.info(f"UIAction: action={request.action}, session_id={request.session_id}")

    if request.type != "ui_action":
        raise HTTPException(
            status_code=400,
            detail="Invalid request type. Expected 'ui_action'.",
        )

    try:
        dispatcher = get_dispatcher()
        result, resolved_session_id = dispatcher.dispatch(
            action=request.action,
            session_id=request.session_id,
            session_data=request.session_data,
        )

        return UIActionResponse(
            type="ui_action_response",
            action=request.action,
            session_id=resolved_session_id,
            status="success" if result.get("response_type") != "error" else "error",
            response_type=result.get("response_type", "data"),
            data=result,
            message=result.get("message"),
        )

    except Exception as e:
        logger.error(f"UIAction dispatch failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"UI Action Engine error: {str(e)}",
        )
