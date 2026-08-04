# CLAUDE.md — Engineering Charter & Permanent Agent Instructions

> This file is the **single source of truth** for how any AI coding agent
> (Claude Code) and any human engineer must work inside the **Aegis AI**
> repository. It is loaded into context automatically. Instructions here
> **override** default behaviour. Read it fully before making any change.

**Related documents:** [ARCHITECTURE.md](ARCHITECTURE.md) ·
[AI_AGENTS.md](AI_AGENTS.md) · [PROJECT_RULES.md](PROJECT_RULES.md) ·
[SECURITY.md](SECURITY.md) · [DATABASE.md](DATABASE.md) ·
[API_REFERENCE.md](API_REFERENCE.md) · [DEPLOYMENT.md](DEPLOYMENT.md) ·
[DEVOPS.md](DEVOPS.md) · [README.md](README.md)

---

## 1. What Aegis AI Is

Aegis AI is a **next-generation Enterprise AI Insurance Platform** — **not a
chatbot**. Its mission is to **educate, guide, and protect** customers, not
merely to sell policies.

Primary users are people insurance products usually underserve:

| Audience | Design implication |
|---|---|
| Middle / lower-middle-class families | Plain language, budget-first framing |
| First-time buyers | Explain jargon; never assume prior knowledge |
| Senior citizens | Large hit-areas, calm tone, low cognitive load |
| Rural users | Low-bandwidth friendly, voice-first friendly |
| Tamil / Thanglish / English speakers | Multilingual, code-switching tolerant |

Every engineering decision is judged against this mission. **Clarity, trust,
and accessibility outrank cleverness.**

---

## 2. Golden Rules (Never Violate)

1. **Do NOT change business logic** unless the task explicitly asks for it.
2. **Do NOT alter these protected workflows** — they are the product:
   - Multi-agent orchestration & agent transfer logic
   - Insurance recommendation / scoring / premium workflows
   - Voice workflow (SSE streaming + `useVoice`)
   - Conversation memory & customer-profile persistence
3. **Preserve the existing architecture.** Improve quality *within* it; do not
   redesign it.
4. **Secrets never enter git.** No real keys, tokens, `.env`, or `dev.db` in a
   commit, ever. See [SECURITY.md](SECURITY.md).
5. **Fail safe.** When unsure whether a change affects a protected workflow,
   stop and ask rather than guess.
6. **No placeholder work.** Ship real, working, verified changes — never stubs
   presented as complete.

---

## 3. Repository Map (authoritative)

```
salesbots/
├── Aegis-AI/          # Layered rule-driven insurance reasoning knowledge base (data + governance)
│   ├── layer1/        # Domain knowledge (health, motor, travel, home-property, executive)
│   ├── layer2/        # Routing: advisor/category routers, context loader, decision engine
│   ├── layer3/        # Memory: conversations, customer profiles, intelligence, rec-context
│   ├── layer4/        # Recommendation: scoring, risk, comparison, policy matching
│   └── layer5/        # Executive: approval engine, analytics, executive memory
├── ai-python/         # FastAPI multi-agent AI engine (the "brain")
├── backend/           # Node.js + Express + Prisma API (auth, leads, policies, chat bridge, sockets)
└── frontend/          # Next.js + React + TypeScript + Tailwind UI
```

The `Aegis-AI/` layer names are opaque, so they are spelled out above. The
service trees are not — read them with `ls` when you need them.

For the full component and data-flow model, see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 4. Technology Standards

| Layer | Stack | Non-negotiables |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind | Strict TS, no `any` in new code, accessible components |
| API | Node.js + Express + Prisma | Controller/service split, validated input, `catchAsync` |
| AI Engine | Python 3.13 + FastAPI + Pydantic v2 | Typed schemas, async I/O, provider-agnostic LLM layer |
| LLM | Ollama (default) / Gemini / OpenAI | Selected via `DEFAULT_PROVIDER`; **never hardcode a provider** |
| DB | SQLite (dev) → Postgres (prod path) | Access only through Prisma; see [DATABASE.md](DATABASE.md) |
| Realtime | Socket.io + SSE | JWT-authenticated handshake; SSE for voice/stream |

---

## 5. Coding Standards

Per-language rules live next to the code they govern and load when you work
there: `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `ai-python/CLAUDE.md`.

---

## 6. Architecture Protection Rules

The multi-agent design is the crown jewel. When touching `ai-python/`:

- **Agent isolation is sacred.** Each agent has its own environment, config,
  and memory namespace (`{domain}_{customer_id}`). Do not let one domain read
  or write another's memory except via the sanctioned cross-domain export in
  `MemoryOrchestrator`.
- **Transfers are user-consented.** Never auto-execute a domain transfer without
  the approval flow (`suggest_transfer` → user approves → `force_transfer_to`).
- **The orchestrator is the only router.** New capabilities register through
  `EnvironmentRegistry`; they do not bypass `CentralOrchestrator.dispatch`.
- **The streaming path is the voice path.** Changes to `stream_service` /
  `stream_routes` / `useVoice` require explicit sign-off.

---

## 7. Refactoring Rules

- Refactor **only** with green verification before and after (see §10).
- Remove duplication by consolidating to one implementation, then updating all
  call sites in the same change.

---

## 8. Security Rules (summary — full policy in [SECURITY.md](SECURITY.md))

- **Secrets:** only in gitignored `.env`; templates in `.env.example` carry
  placeholders. Rotate any key that is ever exposed.
- **Auth:** JWT in an **httpOnly** cookie; Bearer accepted for API clients.
  RBAC via `restrictTo`. Public registration is always `customer`.
- **Isolation:** the AI engine is gated by `X-Internal-Api-Key` (constant-time
  compare, fail-closed in production).
- **Input:** validate and **bound** all external input (Node schemas + Pydantic
  `max_length`). Never trust client-supplied identity/role.
- **Tenant isolation:** every query that returns user data must be scoped by
  `userId`. Cross-tenant leakage is a **critical** defect.
- **Output:** production errors are generic; details are logged server-side only.

---

## 9. Performance Rules

- Never make an unbounded DB query — always `take`/paginate.
- Cache expensive AI work (recommendation cache keys on a profile hash;
  invalidate when the profile changes).
- Keep the paid-LLM path rate-limited (`aiLimiter`, per-socket throttle).
- Prefer streaming (SSE) for long responses so users see progress immediately.
- Frontend: code-split heavy routes; avoid blocking the main thread on the
  advisor/voice screens.

---

## 10. Automatic Validation Workflow (run for every change)

Before declaring any task complete, run the relevant checks and **fix anything
you introduced**:

| Area | Command | Must pass |
|---|---|---|
| Node syntax | `node --check <file>` | all changed files |
| Backend boot | load `src/app.ts` + env validation | no startup error |
| Python syntax | `python -m py_compile app/**/*.py` | all files |
| Python import | `python -c "import main"` | app + all agents boot |
| Frontend types | `npx tsc --noEmit` | exit 0 |
| Frontend lint | `npx next lint` | no **new** errors |
| Live smoke | boot service + curl the touched endpoint | expected status codes |

Pre-existing failures that you did **not** introduce are reported, not silently
"fixed" by touching protected code.

---

## 11. Reporting Format

Every non-trivial task ends with a concise report:

```
## Summary
<what changed, in one or two sentences>

## Files Changed
<path> — <one-line reason>

## Verification
<check> — <result>

## Remaining / Manual Work
<items that need human or infra action, with why>

## Risk & Rollback
<what could break; how to revert>
```

For security work, additionally include **severity classification**, **before/
after score**, and **attack scenario** per finding.

---

## 12. Git & Commit Discipline

- Commit or push **only when asked**.
- Verify no secret/`.env`/`dev.db`/`node_modules`/`venv` is staged (`git
  check-ignore`) before every commit.
- One logical change per commit; imperative subject; body explains **why**.
- End commit messages with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## 13. When In Doubt

Ask. A five-second question is cheaper than a broken recommendation engine, a
leaked customer profile, or a regressed voice workflow. The mission — *educate,
guide, protect* — applies to how we treat the codebase too.
