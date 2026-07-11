# CHANGELOG.md — Aegis AI Version History

> All notable changes to Aegis AI. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
> This project uses [Semantic Versioning](https://semver.org/).
>
> **See also:** [README.md](README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
> [SECURITY.md](SECURITY.md) · [AI_AGENTS.md](AI_AGENTS.md)

---

## [Unreleased] — 1.0.0-dev

> Current development head. All items below are on `main` but not yet versioned
> for a stable production release.

### Added
- Session 3 documentation: `README.md` (improved), `API_REFERENCE.md`,
  `DEPLOYMENT.md`, `CHANGELOG.md`, `UI_GUIDELINES.md`.
- Cross-referenced all six existing docs in new documents.

---

## [0.5.0] — 2026-07-11 · Commit `2e0c99a`

**docs: add project rules, security policy, and data model (Session 2)**

### Added
- `PROJECT_RULES.md` — comprehensive naming, coding, folder, git, and testing
  conventions for all three runtimes (TypeScript, Node, Python).
- `SECURITY.md` — authoritative security policy: authentication, RBAC, service
  isolation (`X-Internal-Api-Key`), rate limits, OWASP alignment, hardening
  backlog, and incident response baseline.
- `DATABASE.md` — full Prisma data model with ER diagram, field-level detail
  for all six models, index recommendations, migration procedures
  (dev `db:push` / prod `migrate deploy`), scaling path to PostgreSQL, and data
  classification.

### Changed
- `CLAUDE.md` cross-references updated to include `API_REFERENCE.md` and new
  Session 2 documents.

---

## [0.4.0] — 2026-07-10 · Commit `6b09e02`

**docs: add enterprise architecture documentation (Session 1)**

### Added
- `CLAUDE.md` — engineering charter: golden rules, repository map, technology
  standards, coding standards, architecture protection rules, refactoring rules,
  security rules, performance rules, validation workflow, reporting format, and
  git discipline. All AI coding-agent instructions.
- `ARCHITECTURE.md` — authoritative system design: high-level topology Mermaid
  diagram, frontend/backend/AI-engine module maps, request middleware chain,
  backend ↔ AI bridge, multi-agent dispatch flow, Aegis-AI layers 1–5,
  memory architecture, recommendation engine, voice/SSE layer, end-to-end data
  flow, security layer summary, deployment topology target, and architectural
  invariants.
- `AI_AGENTS.md` — per-agent profiles (Executive Manager, Sarah, Alex, Emma,
  Ethan), shared `BaseInsuranceAgent` capability table, agent workflow diagram,
  consent-based transfer rules, memory model, intent/interrupt intelligence,
  roadmap for 10 future agents, and expansion principles.

---

## [0.3.0] — 2026-07-09 · Commit `26beb6b`

**Recover full app source + security hardening, role fix, admin-portal gating**

### Added
- Full `ai-python/` FastAPI multi-agent engine source recovered and restored.
- Full `backend/` Express + Prisma source recovered.
- Full `frontend/` Next.js source recovered.
- `Aegis-AI/` layered knowledge base (layers 1–5) restored.

### Changed
- **Role escalation fix:** public registration endpoint now ignores the `role`
  field in the request body; all public registrations are forced to `customer`.
  Previously, clients could self-assign `admin` or `superadmin`.
- **Admin portal gating:** `/admin-login` now validates role on the server and
  tears down any session for non-admin users who reach the admin portal.
- **Password validation hardened:** 72-byte upper bound added to prevent bcrypt
  truncation and hashing-DoS attacks. Lower bound enforced at 6 characters.
- **Anti-enumeration:** login now runs `bcrypt.compare` against a dummy hash
  when the email is not found, making success and failure responses
  timing-indistinguishable.
- **Bcrypt cost factor** raised to 12 (from 10 in earlier versions).

### Fixed
- AI engine environment and agent boot failures from missing source files.
- `MemoryOrchestrator` import cycle resolved.
- Socket.io JWT authentication missing in prior version.

---

## [0.2.0] — 2026-07-08 · Commit `0b4e751`

**Security hardening: secrets hygiene, auth, CORS, service isolation**

### Added
- `backend/.env.example` — environment template for the Node backend with
  documented security notes per variable.
- `ai-python/.env.example` — environment template for the FastAPI AI engine.
- `frontend/.env.example` — Next.js public variable template.
- `X-Internal-Api-Key` gate (`middleware/internal_auth.py`) on AI engine routes
  with constant-time comparison (`hmac.compare_digest`) and fail-closed
  behaviour in production.
- Helmet middleware with HSTS (`max-age=31536000`, `includeSubDomains`,
  `preload`), `no-referrer` referrer policy, `same-site` CORP, and
  `X-Powered-By` disabled.
- Strict CORS allowlist (`CLIENT_URL` / `ALLOWED_ORIGINS`) — no wildcard +
  credentials combination.
- Three-tier rate limiting: `apiLimiter` (100/15 min), `authLimiter` (20/hr),
  `aiLimiter` (20/min) + per-socket throttle.
- Body size cap: JSON and URL-encoded capped at 10 kb.
- `TRUST_PROXY` configuration for accurate client-IP derivation.
- `config/env.js` fail-fast validation — backend refuses to start without
  `JWT_SECRET`; in production, rejects short or known-weak secrets.
- `httpOnly` cookie delivery for JWT (`aegis_token`); `secure` flag controlled
  by `COOKIE_SECURE`.
- Tenant isolation: all `Chat` queries now scoped by `userId`.
- Upload file-type guard: extension AND MIME must both be on the allowlist;
  generated filenames server-side.
- Static `/uploads` path gated behind `protect` middleware with `dotfiles:
  deny`.

### Changed
- JWT also returned in response body (for backward-compatibility with API
  clients — flagged as low-severity in [SECURITY.md §12](SECURITY.md) for
  future removal).
- Socket.io CORS uses the same strict allowlist as the HTTP API.

### Removed
- Wildcard CORS origin that was combined with `credentials: true` (XSS +
  CSRF risk).
- Hardcoded secrets from source files.

---

## [0.1.0] — Initial Commit · Commit `af9106b`

**first commit**

### Added
- Initial monorepo scaffold:
  - `frontend/` — Next.js 14 app with App Router, Tailwind CSS, TypeScript.
  - `backend/` — Express + Prisma API with auth, leads, policies, chat, upload
    routes.
  - `ai-python/` — FastAPI service skeleton.
  - `Aegis-AI/` — initial layered knowledge-base scaffold.
- Prisma schema with `User`, `Company`, `Policy`, `Lead`, `Chat`, and
  `UploadedDocument` models.
- Consumer dashboard, admin dashboard, advisor, and policies pages.
- `AIChatMessage` with `[RECOMMENDATION:...]` payload parsing and holographic
  plan cards.
- `VoiceEngine` component with Web Speech API and TTS streaming.
- `ThemeContext` with localStorage `aegis_theme` persistence (dark default).
- Socket.io real-time chat wiring.
- Multi-agent Python engine with Sarah AI (health), Alex AI (motor), Emma AI
  (property), Ethan AI (travel), and Executive Manager AI.
- `CentralOrchestrator` with intent detection, consent-based transfers,
  interrupt detection, and workflow snapshots.
- `MemoryOrchestrator` with two-tier customer profiles (shared + domain) and
  recommendation cache keyed by profile hash.
- Provider-agnostic `llm_service` (Ollama / Gemini / OpenAI via
  `DEFAULT_PROVIDER`).

---

## Breaking Changes Log

| Version | Change | Migration |
|---|---|---|
| 0.3.0 | Public register no longer accepts `role` in request body | Any client setting `role` on registration must remove it; the field is silently ignored rather than errored, so existing clients degrade gracefully |
| 0.3.0 | Password 72-byte upper bound enforced | Passwords longer than 72 bytes (UTF-8) are now rejected with HTTP 400 |
| 0.2.0 | CORS wildcard removed | Frontend must be listed in `CLIENT_URL` / `ALLOWED_ORIGINS` |
| 0.2.0 | `/uploads` path requires authentication | Any client fetching uploads directly must include the auth cookie or Bearer token |
| 0.2.0 | AI engine requires `X-Internal-Api-Key` | All backend-to-AI-engine calls must set this header |

---

## Future Versions (Roadmap)

| Target version | Theme | Key items |
|---|---|---|
| **1.0.0** | Production-ready stable | Docker/compose, Postgres migration, CI pipeline, CSRF protection, upload IDOR fix, SSE gateway |
| **1.1.0** | Post-sale foundation | Claims AI, Renewal AI skeleton agents, Policy Management AI |
| **1.2.0** | Document & payment | Document Verification AI, Payment AI, KYC flow completion |
| **1.3.0** | Intelligence layer | Recommendation AI (cross-domain), Fraud Detection AI |
| **1.4.0** | Voice & language | First-class Tamil / Thanglish / multilingual Voice Layer |
| **2.0.0** | Customer success | Knowledge AI, Customer Success AI, retention flows |

See [AI_AGENTS.md §9](AI_AGENTS.md) for the full roadmap and expansion principles.
