"""
Retrieval-augmented grounding wired into the agents (Phase 8.4 wiring).

Exercises `BaseInsuranceAgent._build_knowledge_context` directly — no LLM call —
so it is deterministic and touches no protected routing/scoring path. Agents are
built with `__new__` to skip heavy environment init; only the class DOMAIN/NAME
attributes are needed.
"""
from app.agents.base_agent import BaseInsuranceAgent


class _HealthAgent(BaseInsuranceAgent):
    DOMAIN = "health"
    NAME = "Sarah AI"


class _ExecAgent(BaseInsuranceAgent):
    DOMAIN = "executive"      # not backed by a knowledge base
    NAME = "Executive AI"


def _agent(cls):
    return cls.__new__(cls)


def test_grounds_a_health_query_with_retrieved_facts():
    ctx = _agent(_HealthAgent)._build_knowledge_context(
        "what is the waiting period for pre-existing disease"
    )
    assert "RELEVANT POLICY KNOWLEDGE" in ctx
    assert "Waiting" in ctx           # the waiting-period section was retrieved
    assert ctx.startswith("\n\n")     # appended as its own block


def test_no_context_for_a_domain_without_knowledge():
    assert _agent(_ExecAgent)._build_knowledge_context("anything at all") == ""


def test_no_context_for_a_blank_message():
    assert _agent(_HealthAgent)._build_knowledge_context("   ") == ""


def test_context_is_bounded_to_top_k():
    ctx = _agent(_HealthAgent)._build_knowledge_context(
        "coverage benefits premium claim tax waiting exclusions"
    )
    assert ctx.count("• [") <= 4      # top_k = 4


def test_retrieval_failure_never_breaks_the_reply(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("index down")

    monkeypatch.setattr("app.services.hybrid_search.get_hybrid_search_engine", boom)
    # A retrieval failure must degrade to no grounding, not raise.
    assert _agent(_HealthAgent)._build_knowledge_context("waiting period") == ""
