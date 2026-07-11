# PROJECT_RULES.md — Conventions & Standards

> The concrete rules that keep the Aegis AI codebase consistent, reviewable, and
> safe to change at scale. These complement the higher-level charter in
> [CLAUDE.md](CLAUDE.md) and the design invariants in
> [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Naming Standards

| Thing | Convention | Example |
|---|---|---|
| React component file | `PascalCase.tsx` | `AIChatMessage.tsx`, `VoiceEngine.tsx` |
| React component | `PascalCase` | `function ConsumerLoginPage()` |
| Hook | `useCamelCase.ts` | `useStreaming.ts`, `useVoice.ts` |
| Context | `XxxContext.tsx` | `AuthContext.tsx` |
| Next.js route folder | `kebab-case/` | `admin-login/`, `consumer-dashboard/` |
| Node file | `kebab.role.js` | `auth.controller.js`, `ai.service.js` |
| Node function | `camelCase` | `getResponseFromAIService` |
| Python module | `snake_case.py` | `central_orchestrator.py`, `sarah_ai.py` |
| Python class | `PascalCase` | `BaseInsuranceAgent`, `MemoryOrchestrator` |
| Python function/var | `snake_case` | `load_profile`, `customer_id` |
| Constant | `UPPER_SNAKE_CASE` | `RATE_MAX`, `DUMMY_HASH`, `ALLOWED_EXTS` |
| Env variable | `UPPER_SNAKE_CASE` | `JWT_SECRET`, `DEFAULT_PROVIDER` |
| DB model (Prisma) | `PascalCase` singular | `User`, `Policy`, `UploadedDocument` |
| Memory key | `{domain}_{customer_id}` | `health_cust_sri` |

**Rule:** match the convention already used by neighbouring files. Never
introduce a second casing style into an existing directory.

---

## 2. Folder Rules

- **One responsibility per directory.** Controllers hold request handling;
  services hold business logic; routes hold wiring only.
- **Node layering** is strict: `route → controller → service → prisma`. A route
  file never talks to Prisma directly; a controller never embeds SQL.
- **AI engine layering:** `routes → services → orchestrator → agents → memory`.
  Agents never import routes; memory never imports agents.
- **Frontend data access** lives in `src/services/`. Pages/components call
  services, never raw `fetch`/`axios` inline.
- **Knowledge/data** lives under `Aegis-AI/layer1–5/`, never inside code
  modules. Code reads data; it does not embed large domain tables.
- **New top-level folders require a doc update** (this file + ARCHITECTURE.md).

---

## 3. Coding Rules

### Universal
- Small functions, clear names, comment the **why**.
- No dead code, no leftover `console.log` / `print`, no commented-out blocks.
- Handle errors explicitly; never swallow exceptions silently (except
  intentional best-effort cleanup, which must be commented).
- No magic numbers — name them (`const RATE_MAX = 20`).

### TypeScript / React
- `strict` TypeScript. **No `any` in new code** (existing `any` is tracked debt).
- Props typed via `interface`. Prefer composition over inheritance.
- `"use client"` only where interactivity requires it.
- Side-effects in `useEffect` with correct dependency arrays.
- Never read the auth JWT from JavaScript — it is an httpOnly cookie; use
  `AuthContext`.

### Node / Express
- Async handlers wrapped in `catchAsync`; throw `AppError` for operational cases.
- Validate every request body with a schema (`validateBody`).
- Return via the standard envelope: `{ status, data }` (or `{ status, message }`
  on error).

### Python / FastAPI
- All I/O is `async`. Request/response bodies are Pydantic v2 models with
  bounded field sizes (`max_length`).
- LLM access only through `llm_service`. Provider is chosen by config, never
  hardcoded.
- Agent code stays in its domain module; cross-domain state flows only through
  `MemoryOrchestrator`.

---

## 4. Component Rules (Frontend)

- One component per file; co-locate only tightly-coupled sub-components.
- Keep components **presentational** where possible; push data/logic into hooks
  and services.
- Loading, empty, and error states are **mandatory** for any data-driven view.
- Accessibility is not optional — see [UI_GUIDELINES.md](UI_GUIDELINES.md)
  (labels, focus, contrast, keyboard).
- Chat/voice components must degrade gracefully on slow networks (the platform
  serves rural and low-bandwidth users).

---

## 5. Architecture Rules

Restated from [ARCHITECTURE.md §12](ARCHITECTURE.md) because they are binding:

1. **Agent isolation** — memory namespaced `{domain}_{customer_id}`; no
   cross-domain reads except the sanctioned transfer export.
2. **Consent-based transfers** — never auto-switch agents.
3. **Single router** — all agent routing goes through `CentralOrchestrator`.
4. **Voice/SSE is load-bearing** — changes require sign-off.
5. **Tenant scoping** — every user-data query filters by `userId`.
6. **Provider-agnostic LLM** — via `llm_service` only.

Changing any of these is an **architecture change**, not a refactor, and needs
explicit approval.

---

## 6. Refactoring Rules

- Behaviour must stay **identical**; verify before and after (see
  [CLAUDE.md §10](CLAUDE.md)).
- Consolidate duplication into one implementation and update **all** call sites
  in the same change.
- Keep public signatures stable; if one must change, update every caller in the
  same commit.
- Never mix a refactor with a feature or a bug fix in one commit.

---

## 7. Git Rules

- Work in logical, self-contained commits; **one concern per commit**.
- Commit or push **only when asked**.
- **Before every commit**, confirm no secret is staged:
  `git check-ignore .env dev.db node_modules venv` and inspect
  `git diff --cached --name-only`.
- `.env`, `dev.db`, DB backups, `node_modules`, `venv`, `__pycache__`, `.next`
  are **never** committed.
- Commit message: imperative subject; body explains **why**; end with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Never rewrite shared history.

---

## 8. Testing & Verification Rules

- New logic ships with the verification appropriate to its layer (syntax,
  typecheck, import, live smoke) per [CLAUDE.md §10](CLAUDE.md).
- A change to a **protected workflow** (agents, recommendation, voice) requires a
  live smoke test proving the workflow still behaves identically.
- Never present unverified work as done. If a step was skipped, say so.

---

## 9. Documentation Rules

- Every new folder, agent, endpoint, or model updates the relevant doc in the
  same change (ARCHITECTURE / AI_AGENTS / API_REFERENCE / DATABASE).
- Keep cross-references accurate. Docs are part of the definition of done.
- Prefer tables and diagrams over prose for structure and flows.

---

## 10. Definition of Done

A change is **done** only when:
1. It meets the coding + naming + folder rules above.
2. It preserves all architecture invariants.
3. Verification is green (and any pre-existing failures are reported, not hidden).
4. No secret is committed.
5. Affected documentation is updated.
6. A concise report is provided in the standard format.
