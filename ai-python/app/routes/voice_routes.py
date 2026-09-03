"""
Aegis AI — Voice transcription route.

    POST /api/ai/voice/transcribe   raw audio bytes in, one transcript out

Internal-only, like every other engine route: the Node backend authenticates
the customer, applies the paid-work rate limit, and forwards the recording with
the shared service key. The browser never reaches this directly — it holds no
`X-Internal-Api-Key`, and a transcription endpoint open to the network is a free
paid-API relay for anyone who finds it.

The body is the audio itself rather than a multipart form. There is exactly one
file, it comes from one trusted caller, and a raw body means the bytes are not
copied through a parser on the way in — which matters when the thing being
copied is up to `STT_MAX_BYTES` per concurrent request. The two pieces of
metadata ride on headers: `Content-Type` carries what the browser recorded,
`X-Audio-Language` carries the interface language as a hint.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.stt_service import (
    SttError,
    get_stt_service,
    is_supported_audio,
    normalise_mime,
)
from app.config.config import settings
from app.utils.logger import logger

router = APIRouter(tags=["Voice"])


class TranscriptionResponse(BaseModel):
    """
    What the backend gets back. Typed so the contract is visible in the OpenAPI
    schema and cannot drift silently — payload drift between these two services
    has bitten this repo before.
    """

    transcript: str = Field(..., description="Exactly what was said, verbatim.")
    language: Optional[str] = Field(
        None,
        description=(
            "Detected language hint — 'en-IN', 'ta-IN', or 'ta-en' for Thanglish. "
            "Metadata only: the transcript goes to the advisor verbatim and the "
            "existing language layer reads it there, as it does for a typed message."
        ),
    )
    provider: str = Field(..., description="Which STT provider answered.")
    duration_ms: int = Field(0, description="How long the provider took.")


@router.post(
    "/voice/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe a recorded voice turn",
    response_description="The transcript plus a language hint",
)
async def transcribe_endpoint(
    request: Request,
    content_type: str = Header(default=""),
    x_audio_language: str = Header(default=""),
) -> TranscriptionResponse:
    audio = await request.body()

    # Refused before the body is handed anywhere else. `Content-Length` is not
    # trusted for this — it is a claim; `len(audio)` is the fact.
    if len(audio) > settings.STT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Recording is too large.")

    if not is_supported_audio(content_type):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type: {normalise_mime(content_type) or 'none'}",
        )

    service = get_stt_service()
    try:
        result = await service.transcribe(
            audio,
            mime_type=content_type,
            language_hint=x_audio_language.strip()[:32] or None,
        )
    except SttError as exc:
        # The internal reason is logged; the caller gets the customer-facing
        # sentence and the status that matches the cause, so the backend can
        # pass a useful message through instead of a generic 502.
        logger.warning(f"STT failed ({type(exc).__name__}): {exc}")
        raise HTTPException(status_code=exc.status_code, detail=exc.user_message) from exc
    except Exception as exc:  # noqa: BLE001 — never leak an internal trace
        logger.error(f"STT unexpected error: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail="Voice input failed. Please type your question.") from exc

    return TranscriptionResponse(
        transcript=result.transcript,
        language=result.language,
        provider=result.provider,
        duration_ms=result.duration_ms,
    )
