"""
Per-environment diagnostics collector (Phase 9.3).

The collector is pull-based: it reads the live EnvironmentDiagnostics from each
agent environment at scrape time and exposes raw counters. These tests drive it
through an isolated CollectorRegistry with a fake environment provider, so no
orchestrator boots, no agent runs, no profile is written, and the protected
streaming/memory paths are never touched.
"""
from prometheus_client import CollectorRegistry

from app.agents.agent_environment import EnvironmentDiagnostics
from app.utils.metrics import EnvironmentDiagnosticsCollector


class _FakeEnv:
    def __init__(self, **kw):
        self.diagnostics = EnvironmentDiagnostics(**kw)


def _registry(pairs):
    reg = CollectorRegistry()
    reg.register(EnvironmentDiagnosticsCollector(lambda: pairs))
    return reg


def _val(reg, name, domain):
    return reg.get_sample_value(name, {"domain": domain})


def test_exposes_raw_counters_per_domain():
    env = _FakeEnv(total_requests=10, total_errors=2, cache_hits=6,
                   cache_misses=4, total_response_time_ms=500.0)
    reg = _registry([("health", env)])

    assert _val(reg, "aegis_ai_env_requests_total", "health") == 10
    assert _val(reg, "aegis_ai_env_errors_total", "health") == 2
    assert _val(reg, "aegis_ai_env_cache_hits_total", "health") == 6
    assert _val(reg, "aegis_ai_env_cache_misses_total", "health") == 4
    assert _val(reg, "aegis_ai_env_response_time_ms_total", "health") == 500.0


def test_cache_hit_rate_is_derivable_from_exposed_counters():
    env = _FakeEnv(cache_hits=6, cache_misses=4)
    reg = _registry([("health", env)])
    hits = _val(reg, "aegis_ai_env_cache_hits_total", "health")
    misses = _val(reg, "aegis_ai_env_cache_misses_total", "health")
    # This is exactly the ratio EnvironmentDiagnostics.cache_hit_rate reports.
    assert hits / (hits + misses) == 0.6


def test_same_domain_across_orchestrators_is_summed():
    # The REST and stream orchestrators each hold their own 'health' environment.
    rest = _FakeEnv(total_requests=3, cache_hits=1)
    stream = _FakeEnv(total_requests=7, cache_hits=2)
    reg = _registry([("health", rest), ("health", stream)])
    assert _val(reg, "aegis_ai_env_requests_total", "health") == 10
    assert _val(reg, "aegis_ai_env_cache_hits_total", "health") == 3


def test_provider_dedupes_the_same_environment_across_orchestrators(monkeypatch):
    """If the REST and stream orchestrators share the *same* environment object,
    the provider must yield it once — otherwise its counters double-count."""
    import sys
    import types

    from app.utils.metrics import _iter_live_environments

    class _Reg:
        def __init__(self, envs):
            self._envs = envs

        def all_environments(self):
            return dict(self._envs)

    shared = _FakeEnv(total_requests=5)

    chat_routes = types.SimpleNamespace(
        _chat_service=types.SimpleNamespace(
            _orchestrator=types.SimpleNamespace(registry=_Reg({"health": shared}))
        )
    )
    stream_service = types.SimpleNamespace(
        _orchestrator=types.SimpleNamespace(registry=_Reg({"health": shared}))
    )
    monkeypatch.setitem(sys.modules, "app.routes.chat_routes", chat_routes)
    monkeypatch.setitem(sys.modules, "app.services.stream_service", stream_service)

    pairs = _iter_live_environments()
    assert len(pairs) == 1  # deduped by identity, not double-counted

    reg = _registry(pairs)
    assert _val(reg, "aegis_ai_env_requests_total", "health") == 5


def test_unknown_domain_collapses_to_other():
    env = _FakeEnv(total_requests=1)
    reg = _registry([("wat-is-this", env)])
    assert _val(reg, "aegis_ai_env_requests_total", "other") == 1
    assert _val(reg, "aegis_ai_env_requests_total", "wat-is-this") is None


def test_executive_domain_is_kept():
    env = _FakeEnv(total_requests=4)
    reg = _registry([("executive", env)])
    assert _val(reg, "aegis_ai_env_requests_total", "executive") == 4


def test_provider_failure_yields_no_samples_not_an_exception():
    def boom():
        raise RuntimeError("registry down")

    reg = CollectorRegistry()
    reg.register(EnvironmentDiagnosticsCollector(boom))
    # A broken provider must degrade to empty, never break the scrape.
    assert _val(reg, "aegis_ai_env_requests_total", "health") is None


def test_environment_without_diagnostics_is_skipped():
    class _Bare:
        diagnostics = None

    reg = _registry([("health", _Bare())])
    assert _val(reg, "aegis_ai_env_requests_total", "health") is None
