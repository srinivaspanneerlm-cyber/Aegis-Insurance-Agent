"""
Environment Registry — Single source of truth for all Aegis AI agent environments.
Plug-and-play: to add a new agent, create the class + config file + add one line here.
"""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.utils.logger import logger
from app.agents.agent_environment import AgentEnvironment


class EnvironmentRegistry:
    """
    Boots and owns all 5 agent environments at startup.
    Provides get/register/health_report interface for the orchestrator.
    """

    def __init__(self, llm_service: Any, memory_engine: Any, decision_engine: Any):
        self._llm = llm_service
        self._memory = memory_engine
        self._decision = decision_engine
        self._envs: Dict[str, AgentEnvironment] = {}
        self._boot()

    # ── Boot ────────────────────────────────────────────────────────────────────

    def _boot(self) -> None:
        """Import all 5 agent classes, load their configs, and create environments."""
        from app.agents.sarah_ai import SarahAI
        from app.agents.alex_ai import AlexAI
        from app.agents.ethan_ai import EthanAI
        from app.agents.emma_ai import EmmaAI
        from app.agents.executive_ai import ExecutiveAI

        agent_specs = [
            ("health",        SarahAI,      "health_agent"),
            ("motor",         AlexAI,       "motor_agent"),
            ("travel",        EthanAI,      "travel_agent"),
            ("home-property", EmmaAI,       "home_property_agent"),
            ("executive",     ExecutiveAI,  "executive_agent"),
        ]

        for domain, agent_class, config_name in agent_specs:
            try:
                config = self._load_config(config_name)
                agent = agent_class(self._llm, self._memory, self._decision)
                env = AgentEnvironment(agent, config)
                self._envs[domain] = env
                logger.info(f"[EnvironmentRegistry] Booted env: domain={domain}, agent={env.name}")
            except Exception as exc:
                logger.error(
                    f"[EnvironmentRegistry] Failed to boot environment for domain={domain}: {exc}"
                )

        logger.info(
            f"[EnvironmentRegistry] Boot complete — {len(self._envs)}/5 environments active"
        )

    def _load_config(self, config_name: str) -> dict:
        """
        Loads config from app/config/agents/{config_name}.json.
        Returns empty dict if file not found or malformed.
        """
        config_path = (
            Path(__file__).resolve().parent.parent
            / "config"
            / "agents"
            / f"{config_name}.json"
        )
        if not config_path.exists():
            logger.warning(f"[EnvironmentRegistry] Config not found: {config_path} — using defaults")
            return {}
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.error(f"[EnvironmentRegistry] Failed to load config {config_path}: {exc}")
            return {}

    # ── Access ──────────────────────────────────────────────────────────────────

    def get(self, domain: str) -> Optional[AgentEnvironment]:
        """Returns the environment for the given domain key, or None."""
        return self._envs.get(domain)

    def domains(self) -> List[str]:
        """Returns all registered domain keys."""
        return list(self._envs.keys())

    def all_environments(self) -> Dict[str, AgentEnvironment]:
        """Returns a copy of the full environment map."""
        return dict(self._envs)

    # ── Health ──────────────────────────────────────────────────────────────────

    def health_report(self) -> Dict[str, Any]:
        """Aggregated health report across all environments."""
        env_reports = {domain: env.health_report() for domain, env in self._envs.items()}
        total_requests = sum(r["diagnostics"]["total_requests"] for r in env_reports.values())
        total_errors = sum(r["diagnostics"]["total_errors"] for r in env_reports.values())
        return {
            "registry_status": "active",
            "total_environments": len(self._envs),
            "domains": self.domains(),
            "aggregate": {
                "total_requests": total_requests,
                "total_errors": total_errors,
                "global_error_rate": (
                    round(total_errors / total_requests, 4) if total_requests > 0 else 0.0
                ),
            },
            "environments": env_reports,
        }

    # ── Hot-registration ────────────────────────────────────────────────────────

    def register(
        self,
        domain: str,
        agent_class: Any,
        config: Optional[dict] = None,
    ) -> AgentEnvironment:
        """
        Hot-register a new agent environment at runtime.
        Useful for plug-and-play addition of new specialist agents without restart.
        """
        agent = agent_class(self._llm, self._memory, self._decision)
        env = AgentEnvironment(agent, config or {})
        self._envs[domain] = env
        logger.info(f"[EnvironmentRegistry] Hot-registered new environment: domain={domain}")
        return env
