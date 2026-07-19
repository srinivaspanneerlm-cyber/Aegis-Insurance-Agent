# syntax=docker/dockerfile:1
#
# Production image for the Aegis AI engine (FastAPI / uvicorn).
#
# IMPORTANT — build context is the REPOSITORY ROOT, not ai-python/:
#   docker build -f ai-python/Dockerfile -t aegis-ai .
#
# Why: the orchestrator dynamically importlib-loads and executes
# Aegis-AI/layer3/…/engine.py + Aegis-AI/layer4/engine.py, and the Layer-3
# memory tree resolves to <repo-root>/Aegis-AI/layer3 via __file__-relative
# paths (parent×4 from app/memory/*.py). Mirroring the host layout
# (/app/ai-python + /app/Aegis-AI) keeps that PROTECTED path logic correct with
# zero code changes.
FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    ENVIRONMENT=production \
    WEB_CONCURRENCY=1

WORKDIR /app/ai-python

# Dependencies first for layer caching.
COPY ai-python/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code (insurance-data is self-contained under ai-python/).
COPY ai-python/app ./app
COPY ai-python/main.py ./
COPY ai-python/insurance-data ./insurance-data

# Rule-driven knowledge base + governance, at the repo-root-relative location
# the engine expects. The mutable, PII-bearing layer3 data dirs are excluded by
# the root .dockerignore and mounted as a volume (created below so the mount
# points exist and are writable).
COPY Aegis-AI /app/Aegis-AI

# Create the nested runtime-memory mount points (excluded from the build
# context via .dockerignore) so the volume mounts land on writable, owned dirs.
RUN useradd --create-home --uid 1000 appuser \
 && mkdir -p /app/Aegis-AI/layer3/conversation_memory/conversations \
             /app/Aegis-AI/layer3/conversation_memory/sessions \
             /app/Aegis-AI/layer3/customer_profile/customer_profiles \
             /app/Aegis-AI/layer3/customer_intelligence/intelligence_profiles \
             /app/Aegis-AI/layer3/recommendation_context/cache \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Liveness only (TCP accept). A richer /health/ready lands in the Monitoring step.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python -c "import socket; socket.create_connection(('127.0.0.1',8000),3).close()" || exit 1

# Single worker by default preserves the orchestrator + file-based Layer-3
# memory semantics (not yet process-safe). Raise WEB_CONCURRENCY only after the
# memory store is made concurrency-safe. Never use --reload in production.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY}"]
