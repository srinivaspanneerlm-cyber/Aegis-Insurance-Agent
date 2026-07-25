# PROD_READINESS.md — Production-Readiness Audit

> Living record of the production-readiness audit and its remediation. Findings
> are triaged P1 (blocker) → P3 (polish). See also [SECURITY.md](SECURITY.md),
> [DEPLOYMENT.md](DEPLOYMENT.md), [DATABASE.md](DATABASE.md),
> [PERFORMANCE.md](PERFORMANCE.md).

## Audit summary (2026-07-25)

Static sweep across all three tiers plus deploy assets. Much is already
production-grade from prior phases — secrets hygiene, security headers, CORS
allowlist, rate limiting, internal-auth gating, health checks in every
Dockerfile + compose, graceful shutdown, full observability (Phase 9), fail-fast
config validation, and a 3-job CI.

### Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| PR‑1a | 🔴 P1 | Dependency vulnerabilities in prod deps (BE 14 / FE 6) | **Done** (this doc §PR‑1a) |
| PR‑1b | 🔴 P1 | Postgres prod path not real (`schema.prisma` hardcodes `provider = "sqlite"`) | Open |
| PR‑2 | 🟡 P2 | Runtime `console.log` in sockets/jobs/cache bypass the pino logger | Open |
| PR‑3 | 🟢 P3 | 30 TODO/FIXME (mostly frontend advisor-transfer + tests) | Open |
| PR‑4 | 🟡 P2 | No dependency-scan in CI · no documented backup/restore · no smoke/e2e | Partly done (CI audit gate landed with PR‑1a) |

---

## PR‑1a — Dependency vulnerability remediation ✅

Applied non-breaking `npm audit fix` on both tiers, plus a targeted `bcrypt`
major bump, and added a CI audit gate.

| Tier | Before (prod deps) | After (prod deps) |
|---|---|---|
| Backend | 14 (1 critical, 6 high, …) | **0** |
| Frontend | 6 (5 high, 1 moderate) | **2 high** (tracked below) |

**Backend → 0.** `npm audit fix` cleared the low/moderate; the remaining
critical (`tar`) + highs were all transitive through `bcrypt@5.1.1 →
@mapbox/node-pre-gyp` (used at *install* time, not in the request path). Bumping
`bcrypt` to `^6.0.0` pulled a patched `node-pre-gyp@2`, clearing the chain — and
also aligned the runtime with `@types/bcrypt@^6`, which was already installed
(the two had drifted). `bcrypt`'s `hash`/`compare` API is unchanged; verified by
the auth test suite + a hash/compare smoke.

**CI gate.** Both the frontend and backend jobs now run
`npm audit --omit=dev --audit-level=critical`, so a *new* critical in production
deps fails the build. It is set to critical (not high) because of the tracked
frontend highs below; tighten to `--audit-level=high` once PR‑1a‑next lands.

### Residual (frontend, tracked — not fixed here)

| Package | Severity | Why not fixed now | Mitigation |
|---|---|---|---|
| `next` | high | Fix requires **Next 15** — a major App-Router upgrade that risks the protected advisor/voice UI, so it needs its own migration (call it **PR‑1a‑next**). All 14.2.x are affected; 14.2.35 is already the latest 14.2. | The vulns are DoS / image-optimizer / RSC issues; the app runs behind nginx (rate limiting, request/body limits), which blunts the DoS surface. |
| `postcss` | high | The vulnerable `8.4.31` is pinned *exactly* by Next 14; a scoped `overrides` is rejected as `invalid` without a risky full lockfile regen. Resolves for free when PR‑1a‑next bumps Next. | **Build-time only** — postcss processes our own source CSS at build, never untrusted input at runtime; it is not shipped to the browser. |

---

## Remaining roadmap

- **PR‑1a‑next** — Next 14 → 15 migration (clears both frontend residuals; protected UI, needs care + sign-off).
- **PR‑1b** — make the Prisma datasource provider env-switchable / add a tested Postgres path, and correct DATABASE.md's "just a connection string" claim.
- **PR‑2** — route runtime `console.log` (sockets, jobs, cache) through the pino logger.
- **PR‑3** — burn down TODO/FIXME (audit which are real vs stale).
- **PR‑4** — documented backup/restore runbook; consider smoke/e2e in CI.
