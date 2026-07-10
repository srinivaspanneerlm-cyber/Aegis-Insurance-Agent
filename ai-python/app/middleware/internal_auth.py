"""
Internal service authentication for the Aegis AI engine.

The AI engine performs paid LLM work and must only be callable by the trusted
Node backend, not by arbitrary clients on the network. This dependency verifies
a shared secret (`X-Internal-Api-Key`) on protected routes.

Backward compatible: if `AI_INTERNAL_API_KEY` is not configured, enforcement is
disabled and requests pass through (so existing local setups keep working).
Configure the key in production to lock the service down.
"""
import hmac
from fastapi import Header, HTTPException, status

from app.config.config import settings
from app.utils.logger import logger


async def require_internal_auth(x_internal_api_key: str = Header(default="")) -> None:
    expected = settings.AI_INTERNAL_API_KEY

    # Enforcement disabled when no key is configured.
    if not expected:
        if settings.is_production:
            # In production, refuse to run unauthenticated — fail closed.
            logger.error("AI_INTERNAL_API_KEY is not set in production; rejecting request.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service is not configured for secure operation.",
            )
        return

    # Constant-time comparison to avoid timing side channels.
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service credentials.",
        )
