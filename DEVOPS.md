# DEVOPS.md — Operations Runbook & Disaster Recovery

> How Aegis AI is containerised, deployed, observed, backed up, and recovered.
> Pairs with [DEPLOYMENT.md](DEPLOYMENT.md) (build/env matrix),
> [ARCHITECTURE.md](ARCHITECTURE.md) (system design), and
> [SECURITY.md](SECURITY.md).

---

## 1. Deployment topology

```mermaid
graph TD
    U["Browser / client"] -->|HTTPS 443| NGINX["nginx edge (TLS, gzip, rate-limit)"]
    NGINX -->|/ , /_next| FE["frontend (Next.js standalone)"]
    NGINX -->|/api, /api/chat/stream (SSE), /socket.io| BE["backend (Node/Express)"]
    BE -->|internal net| AI["ai (FastAPI + Aegis-AI tree)"]
    BE -->|internal net| REDIS[("Redis")]
    BE -->|internal net| DB[("SQLite vol / PostgreSQL")]
    AI --> MEM[["Layer-3 memory volumes"]]
    AI -->|egress| LLM["LLM provider (Gemini/OpenAI/Ollama)"]
```

- **Only nginx is published** (80/443). `frontend`/`backend` sit on the `edge`
  network; `ai`/`redis`/`postgres` are on the `internal` network and are never
  host-exposed.
- The **SSE advisor stream** (`/api/chat/stream`) and **socket.io** paths are
  proxied unbuffered / upgrade-aware — the voice workflow is load-bearing.

---

## 2. Build & run (Docker Compose)

| Stack | File | Command |
|---|---|---|
| Development (hot-reload, SQLite) | `docker-compose.yml` | `docker compose up` |
| Production | `docker-compose.prod.yml` | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` |

Images: `frontend/Dockerfile`, `backend/Dockerfile`, `ai-python/Dockerfile`
(built from the **repo root** — it needs the `Aegis-AI/` tree). All are
multi-stage, non-root, and health-checked. First prod boot:
`docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy`.

Config knobs: `IMAGE_PREFIX`/`IMAGE_TAG` (registry deploys), `NGINX_HTTP_PORT`
(host port; use ≥1024 under rootless), `WEB_CONCURRENCY` (AI workers — keep `1`
until the file-based memory store is process-safe).

---

## 3. Configuration & secrets

- Copy `.env.production.example` → `.env.production` (gitignored) and fill it in.
  It is the single secret source; compose injects it via `env_file` — secrets
  are **never** baked into images or committed.
- Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
  `JWT_SECRET` is fail-fast validated; `AI_INTERNAL_API_KEY` must match on the
  backend and AI engine.
- Per-service env matrix: [DEPLOYMENT.md §4](DEPLOYMENT.md).

---

## 4. Observability

**Health probes** (used by compose healthchecks + any orchestrator):
| Endpoint | Meaning |
|---|---|
| `GET /health/live` (backend + AI) | process is up |
| `GET /health/ready` (backend) | DB reachable (hard); cache + AI reported soft |
| `GET /health/ready` (AI) | orchestrator environments registered |
| `GET /health` (backend, legacy) | preserved for compatibility |

**Metrics** — Prometheus at `GET /metrics` on backend and AI (kept off `/api`,
scrape on the internal network). Backend: process + `http_request_duration_seconds`
+ `aegis_ai_call_duration_seconds`. AI: process CPU/RAM.

**Logs** — structured JSON on **stdout** (12-factor) when `LOG_FORMAT=json`
(default in prod); dev keeps pretty output. Security events ride a dedicated
audit stream (`category:"audit"`): `login.success/failure`, `register`,
`rbac.denied`. Secrets are redacted. Rotation is handled by the compose
`json-file` driver (`max-size` / `max-file`); ship stdout to your aggregator.

---

## 5. Backups & retention

Tooling + schedule live in [scripts/README.md](scripts/README.md).
- `scripts/backup-db.sh` — DB (SQLite/`pg_dump`) + uploads + Layer-3 memory;
  gzipped, sha256-checksummed, pruned by `RETENTION_DAYS` (default 14).
- `scripts/restore-db.sh` — checksum-verified restore (destructive; `FORCE=1`).
- `scripts/aegis-backup.{service,timer}` — daily systemd schedule.
- **Off-host copy is mandatory** — sync `BACKUP_DIR` to object storage; a backup
  on the same disk does not survive disk loss.

---

## 6. CI/CD

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push / PR | typecheck · lint · tests (FE/BE/AI) |
| `security.yml` | push / PR / weekly | npm audit (gate: CRITICAL), pip-audit, Trivy fs |
| `docker-build.yml` | `v*` tag / manual | build + push 3 images to GHCR + Trivy scan |
| `deploy.yml` | manual | SSH → `compose pull && up -d` → migrate → `/health/ready` gate |
| `rollback.yml` | manual | redeploy a prior image tag (no auto DB revert) |

Required repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`,
`GHCR_TOKEN`. Host prerequisite: repo + `.env.production` at `/opt/aegis`.

---

## 7. TLS

nginx ships HTTP + an ACME challenge location; the HTTPS server is
`nginx/conf.d/tls.conf.disabled`. Issue certs (certbot webroot) and enable per
[nginx/README.md](nginx/README.md), then publish `443`.

---

## 8. Disaster recovery

### Failure scenarios
| Failure | Symptom | Response |
|---|---|---|
| **DB down** | `/health/ready` 503, API 5xx | container `restart: unless-stopped`; if data-corrupt, restore (§5) |
| **Redis down** | cache misses, no 5xx | app degrades to no-cache automatically; restart redis |
| **AI engine down** | chat/advisor fails; rest works | `/health/ready` reports `ai:false` (soft); restart `ai`, check LLM keys |
| **LLM provider outage** | advisor errors | switch `DEFAULT_PROVIDER` / key; restart `ai` |
| **Disk full** | writes fail | logs are capped; prune backups; grow disk; check volumes |
| **Bad deploy** | readiness gate fails | `rollback.yml` to last-good tag |
| **Data loss / bad migration** | missing/corrupt data | restore from backup (below) |

### Recovery checklist (data restore)
1. `docker compose -f docker-compose.prod.yml stop backend ai` (quiesce writers).
2. `FORCE=1 DATABASE_URL=… scripts/restore-db.sh <db-archive> [assets-archive]`.
3. `docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy`.
4. `up -d`; confirm `/health/ready` = 200; spot-check data + a chat message.

### Restart strategy
Every service is `restart: unless-stopped` with a healthcheck; the host's Docker
service should be enabled on boot (`systemctl enable docker`).

---

## 9. Production deployment checklist
- [ ] `.env.production` filled; `JWT_SECRET`/`AI_INTERNAL_API_KEY` generated & matched
- [ ] DNS → host; TLS cert issued; `tls.conf` enabled; `443` published
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
- [ ] `prisma migrate deploy` run; `/health/ready` green on backend + AI
- [ ] `/metrics` scraped; logs shipping; backup timer installed + one restore rehearsed + off-host copy configured
- [ ] GH secrets set; `deploy.yml` dry-run; `rollback.yml` validated
- [ ] Rate limits / CORS origins / `COOKIE_SECURE=true` / `TRUST_PROXY` confirmed for the real domain
