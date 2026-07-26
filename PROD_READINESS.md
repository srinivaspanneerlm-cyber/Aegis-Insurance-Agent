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
| PR‑2 | 🟡 P2 | Runtime `console.log` in sockets/jobs/cache bypass the pino logger | **Done** |
| PR‑3 | 🟢 P3 | TODO/FIXME triage — a no-op upload scan | **Done** (this doc §PR‑3) |
| PR‑4 | 🟡 P2 | CI/ops hardening — pre-merge smoke; reconcile audit duplication | **Done** (this doc §PR‑4) |

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

**CI gate.** Dependency scanning is consolidated in `security.yml` (see PR‑4),
which runs `npm audit --omit=dev --audit-level=critical` for both tiers. It
stays at critical (not high) because of the tracked build-time `postcss` high
below; it cannot be tightened to `--audit-level=high` until Next stops
exact-pinning an old `postcss`.

### Residual (frontend) — see PR‑1a‑next

The `next` high is **resolved** by the Next 15 upgrade (PR‑1a‑next). Only a
build-time `postcss` high remains — see that section.

---

## PR‑3 — TODO/FIXME burndown ✅

Triage corrected the count: of the ~30 raw matches, **29 were false positives**
(case-insensitive `TODO` inside `toDomain` / `goToDocuments`, and `XXX` inside
`+91 XXXXXXXXXX` / `cust_xxx.json`). Exactly **one** genuine marker existed:
`fileScan.ts`'s upload scanner was a **no-op that passed every file**.

Fixed it with real defense-in-depth: `scanFile` now does **magic-byte content
validation** — it reads the file's leading bytes and rejects anything that is
not a genuine PDF (`%PDF-`) or DOCX/OOXML zip (`PK\x03\x04`), failing closed on
an unreadable file. This closes a real gap: the multer filter only checks the
*client-declared* MIME, so a renamed executable (`evil.exe` → `evil.pdf`) passed
before and is now rejected + removed. A full antivirus (ClamAV) — which finds
malware *inside* a validly-formatted file — remains a deploy-time addition that
plugs into the same `scanFile` hook.

## PR‑4 — CI / ops hardening ✅

Pre-flight corrected the finding: most of PR‑4 already existed. Backup/restore is
real (`scripts/backup-db.sh`, `restore-db.sh`, systemd `aegis-backup.{service,timer}`,
`scripts/README.md`, DEVOPS.md §5), dependency scanning lives in `security.yml`
(npm audit CRITICAL gate + pip-audit + Trivy), and a deploy-time smoke
(`/health/ready` gate) runs in `deploy.yml` / `rollback.yml`.

Two genuine gaps closed:

- **Pre-merge smoke** — `ci.yml` never booted the app; smoke only ran at deploy.
  A new `smoke` job boots the backend on an ephemeral SQLite DB
  (`prisma migrate deploy`) and runs `scripts/smoke.mjs`, which probes `/health`,
  `/health/live`, DB-gated `/health/ready`, and the JSON 404 path. Fails loud on
  any non-expected status.
- **Audit de-duplication** — the `npm audit --omit=dev --audit-level=critical`
  steps added to `ci.yml` in PR‑1a duplicated `security.yml` (which already ran
  exactly that on the same triggers). Removed from `ci.yml`; `security.yml` is the
  single home for dependency/vuln scanning.

## PR‑1a‑next — Next 14 → 15 (+ React 19) ✅

Upgraded `next` 14.2.35 → **15.5.21** and `react`/`react-dom` 18 → **19** (plus
`eslint-config-next` and `@types/react{,-dom}`). Blast radius was small: the app
uses **no** async request APIs (`cookies()`/`headers()`/`draftMode()`) and **no**
server-component `params`/`searchParams`, so the headline Next‑15 breaks did not
apply. The only code change was widening five ref-prop types to
`RefObject<T | null>` (React 19's `useRef(null)` return type).

**Security outcome:** the `next` runtime CVEs (DoS / RSC / image-optimizer
`remotePatterns`) are **cleared**. The upgrade also surfaced two transitive
highs, one of which was fixed:

| Package | Result |
|---|---|
| `next` runtime CVEs | ✅ Cleared by 15.5.21 |
| `sharp` (image optimizer; fresh 2026‑07 libvips CVEs) | ✅ Cleared via `overrides: { sharp: "^0.35.3" }` (Next pins `^0.34.3`; the 0.35 bump is API-compatible and the build + image path verified) |
| `postcss` | ⚠️ Remains — Next 15 still exact-pins `8.4.31`; **build-time only** (processes our own source CSS, never shipped) |

Verified: tsc 0 · vitest 230 · lint 0 errors · `next build` clean · bundle within
budget (total 1864 KB, largest 185 KB) · `next start` serves `/`, `/login`,
`/advisor` → 200 under React 19. **Manual QA still needed:** interactive voice
(mic + SSE streaming) and agent transfers require a browser with the backend +
AI engine running — not verifiable in CI.

## Remaining roadmap

- **Deploy-time (needs real infra):** generate + apply the Postgres migration lineage (PR‑1b mechanism is in place); drop in a ClamAV scanner behind the `scanFile` hook (PR‑3 magic-byte check is in place).
- **Watch:** the build-time `postcss` high clears whenever Next unpins it; tighten the CI audit gate to `--audit-level=high` at that point.
