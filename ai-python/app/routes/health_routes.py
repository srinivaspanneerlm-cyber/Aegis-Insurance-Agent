"""Environment health check endpoints for Aegis AI agent environments."""
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Environment Health"])


@router.get(
    "/environments/health",
    summary="Get health status of all agent environments",
)
async def environment_health():
    """Returns aggregated health report for all 5 agent environments."""
    from app.services.stream_service import _orchestrator
    return _orchestrator.get_environment_health()


@router.get(
    "/environments/{domain}/health",
    summary="Get health status for a single agent environment",
)
async def single_environment_health(domain: str):
    """Returns detailed health report for the specified agent environment."""
    from app.services.stream_service import _orchestrator
    env = _orchestrator.registry.get(domain)
    if not env:
        raise HTTPException(
            status_code=404,
            detail=f"No environment registered for domain: {domain}. "
                   f"Available domains: {_orchestrator.registry.domains()}",
        )
    return env.health_report()
