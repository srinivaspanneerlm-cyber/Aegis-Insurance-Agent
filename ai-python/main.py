"""
🛡️ Aegis AI Insurance Engine - Production FastAPI Application
Sovereign AI-powered Insurance Conversation Engine
"""

from fastapi import FastAPI, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.routes import chat_routes, action_routes, stream_routes, voice_routes
from app.routes.health_routes import router as health_router
from app.models.schemas import ChatRequest, ChatResponse
from app.middleware.internal_auth import require_internal_auth
from app.utils.logger import logger
from app.config.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle manager."""
    logger.info("🛡️  Aegis AI Insurance Conversational Engine starting up...")
    logger.info(f"🤖  Active LLM Provider: {settings.active_provider.upper()}")
    yield
    logger.info("🔒  Aegis AI Engine shutting down gracefully...")


# ---------------------------------------------------------------------------
# FastAPI App Factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Aegis AI Insurance Engine",
    description=(
        "Production-ready AI Insurance Conversation Service powered by "
        "direct Gemini & OpenAI dual-stack LLMs. Provides empathetic, "
        "professional insurance recommendations and choose-your-plan conversational intake."
    ),
    version="1.0.0",
    # Interactive API docs are disabled in production to avoid exposing the
    # full internal API surface publicly.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware — strict allowlist sourced from ALLOWED_ORIGINS (no wildcard)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Monitoring — liveness / readiness / Prometheus metrics (root-level, additive).
# No request middleware is added, so the protected streaming path is untouched.
# ---------------------------------------------------------------------------
@app.get("/health/live", tags=["Health"], include_in_schema=False)
async def health_live():
    """Process is up (never touches the orchestrator or any dependency)."""
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"], include_in_schema=False)
async def health_ready(response: Response):
    """Ready once the multi-agent orchestrator has registered environments."""
    domains: list = []
    try:
        from app.services.stream_service import _orchestrator
        domains = list(_orchestrator.registry.domains())
    except Exception:
        domains = []
    ready = len(domains) > 0
    if not ready:
        response.status_code = 503
    return {"status": "ready" if ready else "not_ready", "environments": domains}


@app.get("/metrics", include_in_schema=False)
async def metrics():
    """Prometheus exposition — default process metrics (CPU, RAM, FDs), AI
    reasoning metrics (dispatch latency, LLM call latency, token usage), and
    per-environment diagnostics (requests, errors, cache hits/misses, response
    time — pulled live from each agent environment at scrape time)."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ---------------------------------------------------------------------------
# Root POST Endpoint (As requested: POST /ai-chat)
# ---------------------------------------------------------------------------
@app.post(
    "/ai-chat",
    response_model=ChatResponse,
    summary="Submit query directly to Aegis AI Advisor at root level",
    tags=["Root AI Advisor Chat"],
    dependencies=[Depends(require_internal_auth)],
)
async def root_chat_endpoint(request: ChatRequest):
    """Direct root POST endpoint — routes through multi-agent orchestrator."""
    # Shape only, never content — see app/routes/chat_routes.py for the same
    # policy on its sibling endpoints.
    logger.info(f"Received request on POST /ai-chat: chars={len(request.message)}")
    try:
        from app.routes.chat_routes import get_chat_service, _result_to_response
        service = get_chat_service()
        result = await service.dispatch(
            request.message, request.history, request.user_name,
            request.product_type, request.session_id
        )
        return _result_to_response(result)
    except Exception as e:
        # Log the full error server-side, but never echo internal exception
        # details (stack traces, file paths, provider errors) back to the
        # caller — that would leak implementation details to clients.
        logger.error(f"Root endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error.")


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------
# Internal-only routers — require the shared service key (when configured).
app.include_router(
    chat_routes.router,
    prefix="/api/ai",
    tags=["AI Advisor Chat"],
    dependencies=[Depends(require_internal_auth)],
)

app.include_router(
    action_routes.router,
    prefix="/api/ai",
    tags=["UI Action Engine"],
    dependencies=[Depends(require_internal_auth)],
)

# The browser no longer reaches this endpoint directly — the Node backend
# authenticates the customer, applies the AI rate limit, and proxies the stream
# through, so this can be gated like every other route. It matters more here
# than elsewhere: `user_name` in the request body is resolved straight to a
# customer's profile and conversation memory, so an ungated stream let any
# caller read and write any customer's data by naming them.
app.include_router(
    stream_routes.router,
    prefix="/api/ai",
    dependencies=[Depends(require_internal_auth)],
    tags=["Streaming Chat"],
)

# Voice transcription. Internal-only for the same reason the stream is: it
# spends paid provider quota per call, and an open transcription endpoint is a
# free relay to that provider for anyone who finds it.
app.include_router(
    voice_routes.router,
    prefix="/api/ai",
    dependencies=[Depends(require_internal_auth)],
    tags=["Voice"],
)

# Health router stays public for load-balancer / uptime probes.
app.include_router(
    health_router,
    prefix="/api/ai",
)


# ---------------------------------------------------------------------------
# Health Check Endpoint
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
async def root():
    """Root health check endpoint."""
    return {
        "status": "online",
        "service": "Aegis AI Insurance Engine",
        "version": "1.0.0",
        "provider": settings.active_provider,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness probe for monitoring / load balancers.

    Intentionally minimal: it must not disclose which LLM providers or API
    keys are configured, since this endpoint is publicly reachable.
    """
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# Run with Uvicorn if executed directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info",
    )
