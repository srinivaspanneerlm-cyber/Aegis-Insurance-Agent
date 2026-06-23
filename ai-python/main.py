"""
🛡️ Aegis AI Insurance Engine - Production FastAPI Application
Sovereign AI-powered Insurance Conversation Engine
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routes import chat_routes
from app.models.schemas import ChatRequest, ChatResponse
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
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware — Allow Node.js backend (port 5000) and frontend (port 3000)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Root POST Endpoint (As requested: POST /ai-chat)
# ---------------------------------------------------------------------------
@app.post(
    "/ai-chat",
    response_model=ChatResponse,
    summary="Submit query directly to Aegis AI Advisor at root level",
    tags=["Root AI Advisor Chat"]
)
async def root_chat_endpoint(request: ChatRequest):
    """
    Direct root POST endpoint for AI Insurance advisor interaction.
    """
    logger.info(f"Received request on POST /ai-chat: '{request.message[:60]}...'")
    try:
        from app.routes.chat_routes import get_chat_service
        service = get_chat_service()
        reply = await service.generate_response(request.message, request.history, request.user_name, request.product_type)
        return ChatResponse(reply=reply)

    except Exception as e:
        logger.error(f"Failed to process chat query on root endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred while generating the advice: {str(e)}"
        )


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------
app.include_router(
    chat_routes.router,
    prefix="/api/ai",
    tags=["AI Advisor Chat"],
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
    """Detailed health check for monitoring."""
    return {
        "status": "healthy",
        "llm_provider": settings.active_provider,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "openai_configured": bool(settings.OPENAI_API_KEY),
    }


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
