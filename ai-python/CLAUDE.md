# AI Engine — Coding Standards

Applies to `ai-python/` (Python 3.13 + FastAPI + Pydantic v2).
Repo-wide rules are in the root [CLAUDE.md](../CLAUDE.md).

- All request/response bodies are **Pydantic models** with bounded field sizes.
- Agent logic stays inside its domain module; cross-domain data flows through
  `MemoryOrchestrator` only.
- LLM calls go through `llm_service` — no direct SDK calls elsewhere.
