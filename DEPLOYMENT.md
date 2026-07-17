# DEPLOYMENT.md — Build, Deploy & Operations

> How to build, configure, run, and monitor every Aegis AI service across
> development, testing, and production. Includes environment variable matrix,
> database migration procedures, target Docker configuration, rollback, and
> health-check references.
>
> **See also:** [ARCHITECTURE.md §11](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) ·
> [DATABASE.md](DATABASE.md) · [API_REFERENCE.md §6.1](API_REFERENCE.md) ·
> [CLAUDE.md](CLAUDE.md)

---

## 1. Environments

| Environment | Purpose | Database | LLM | Docs UI |
|---|---|---|---|---|
| `development` | Local feature work | SQLite (`file:./dev.db`) | Any (`DEFAULT_PROVIDER`) | Enabled (`/docs`) |
| `testing` | CI / QA staging | SQLite or Postgres staging | Ollama / Gemini | Enabled |
| `production` | Live customer traffic | PostgreSQL (managed) | Gemini / OpenAI / Ollama Cloud | **Disabled** |

> In production, the FastAPI `/docs`, `/redoc`, and `/openapi.json` routes are
> disabled automatically when `ENVIRONMENT=production`. Do not re-enable them.

---

## 2. Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 18.x | Backend + frontend build |
| npm | 9.x | |
| Python | 3.11 (3.13 preferred) | AI engine |
| pip | Latest | |
| PostgreSQL | 14+ | Production DB only |
| Git | Any recent | |

Optional (for containerised deployment):
- Docker Engine 24+
- Docker Compose 2.x

---

## 3. Per-Service Build & Run

### 3.1 AI Engine (`ai-python`)

**Development:**

```bash
cd ai-python
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # Edit .env with real keys
python main.py                 # Uvicorn starts on http://0.0.0.0:8000
```

Or use the convenience script:

```bash
bash start.sh
```

**Production build:**

```bash
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

For production, set `ENVIRONMENT=production` in `.env` to disable docs UI and
tighten CORS.

**Health check:** `GET http://localhost:8000/health` → `{"status":"healthy"}`

---

### 3.2 Backend (`backend`)

**Development:**

```bash
cd backend
npm install
cp .env.example .env           # Edit .env — JWT_SECRET and AI_INTERNAL_API_KEY required
npm run db:push                # Sync schema.prisma → SQLite dev.db
node prisma/seed.js            # Seed reference data (companies, policies)
npm run dev                    # Starts src/server.js on http://localhost:5000
```

**Production build:**

```bash
npm install --omit=dev
npx prisma migrate deploy      # Versioned migrations for Postgres
npm start                      # node src/server.js
```

**Database studio (dev):**

```bash
npm run db:studio              # Prisma Studio at http://localhost:5555
```

---

### 3.3 Frontend (`frontend`)

**Development:**

```bash
cd frontend
npm install
cp .env.example .env.local     # Set NEXT_PUBLIC_API_URL
npm run dev                    # Next.js dev server at http://localhost:3000
```

**Production build:**

```bash
npm run build                  # Type-check + bundle (next build)
npm start                      # Start production server (next start)
```

**Type check only:**

```bash
npx tsc --noEmit
```

---

## 4. Environment Variable Matrix

All real secrets live in gitignored `.env` files. Templates are in
`.env.example` files. See [SECURITY.md §9](SECURITY.md) for secrets hygiene rules.

### 4.1 AI Engine (`ai-python/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8000` | Uvicorn listen port |
| `HOST` | No | `0.0.0.0` | Uvicorn bind host |
| `ENVIRONMENT` | No | `development` | `development` \| `production` |
| `DEFAULT_PROVIDER` | Yes | `ollama` | `ollama` \| `gemini` \| `openai` |
| `OLLAMA_BASE_URL` | Conditional | `http://localhost:11434` | `https://ollama.com` for Ollama Cloud |
| `OLLAMA_MODEL` | Conditional | `gpt-oss:20b` | Ollama model name |
| `OLLAMA_API_KEY` | Conditional | `ollama` | Ollama key (ollama.com key for Cloud) |
| `GEMINI_API_KEY` | Conditional | — | Required if `DEFAULT_PROVIDER=gemini` |
| `OPENAI_API_KEY` | Conditional | — | Required if `DEFAULT_PROVIDER=openai` |
| `AI_INTERNAL_API_KEY` | Yes (prod) | — | Shared secret; must match backend's value |
| `ALLOWED_ORIGINS` | Yes (prod) | `http://localhost:3000,...` | CORS allowlist (comma-separated) |
| `CHROMA_DB_PATH` | No | `./chroma` | ChromaDB vector store path |
| `UPLOADS_DIR` | No | `uploads` | Upload directory path |

### 4.2 Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Express listen port |
| `NODE_ENV` | No | `development` | `development` \| `production` |
| `DATABASE_URL` | Yes | `file:./dev.db` | Prisma connection string |
| `JWT_SECRET` | Yes | — | **≥ 32 chars, high-entropy.** Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | `30d` | JWT lifetime |
| `CLIENT_URL` | Yes (prod) | `http://localhost:3000` | Frontend origin for CORS |
| `COOKIE_SECURE` | No | `false` | Set `true` when serving over HTTPS |
| `AI_SERVICE_URL` | Yes | `http://localhost:8000/api/ai` | AI engine base URL |
| `AI_INTERNAL_API_KEY` | Yes (prod) | — | Shared secret; must match AI engine's value |
| `TRUST_PROXY` | No | `false` | Number of front proxies; never `true` |
| `AUTO_RELEASE_PORT` | No | `false` | Kill port on start (dev only) |

### 4.3 Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5000/api` | Backend REST base URL (browser-visible) |

> `NEXT_PUBLIC_*` variables are bundled into the client build. Never put secrets
> here.

---

## 5. Database Migration

### 5.1 Development (SQLite)

```bash
cd backend

# Apply schema changes (no migration history — dev only)
npm run db:push          # alias for: npx prisma db push

# Seed reference data
node prisma/seed.js

# Browse data
npm run db:studio
```

### 5.2 Production (PostgreSQL)

1. Set `DATABASE_URL` to a PostgreSQL connection string:

   ```
   DATABASE_URL="postgresql://user:password@host:5432/aegis_db?schema=public"
   ```

2. Run versioned migrations (idempotent, safe for CI):

   ```bash
   npx prisma migrate deploy
   ```

3. Seed if this is a fresh installation:

   ```bash
   node prisma/seed.js
   ```

**Migration discipline:**
- Every schema change must generate a versioned migration file
  (`npx prisma migrate dev --name <description>`) in development.
- Never run `prisma db push` in production — it skips the migration history.
- Keep migration files committed and reviewed like code changes.
- Snapshot the database before any destructive migration:
  `pg_dump aegis_db > aegis_db_backup_$(date +%Y%m%d).sql`

See [DATABASE.md §5](DATABASE.md) for the full migration and backup procedure.

---

## 6. Target Docker / Containerisation

> No `Dockerfile` or `docker-compose.yml` exists in the repository today.
> The configurations below are the **recommended reference targets** to implement
> before a containerised production deployment.

### 6.1 Reference Dockerfile — AI Engine

```dockerfile
# ai-python/Dockerfile
FROM python:3.13-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 6.2 Reference Dockerfile — Backend

```dockerfile
# backend/Dockerfile
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 5000
CMD ["node", "src/server.js"]
```

### 6.3 Reference Dockerfile — Frontend

```dockerfile
# frontend/Dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
```

### 6.4 Reference docker-compose.yml

```yaml
version: "3.9"

services:
  ai-engine:
    build: ./ai-python
    ports:
      - "8000:8000"
    env_file: ./ai-python/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    env_file: ./backend/.env
    depends_on:
      ai-engine:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/auth/me"]
      interval: 30s
      timeout: 5s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: ./frontend/.env.local
    depends_on:
      - backend
    restart: unless-stopped
```

---

## 7. Production Deployment Steps

```mermaid
graph TD
    C["Code merged to main"] --> B["CI: tsc + lint + py_compile + smoke tests"]
    B --> IMG["Build container images"]
    IMG --> REG["Push to container registry"]
    REG --> DB["Run: prisma migrate deploy"]
    DB --> DEPLOY["Rolling deploy: AI engine → backend → frontend"]
    DEPLOY --> HC["Health-check probes green?"]
    HC -- Yes --> LIVE["Traffic routed to new pods"]
    HC -- No --> RB["Rollback (see §8)"]
```

### Step-by-step

1. **Validate** — run `npx tsc --noEmit` (frontend), `node --check src/app.js`
   (backend), `python -m py_compile app/**/*.py` (AI engine).
2. **Build images** — build Docker images for each service and tag with the git
   SHA.
3. **Push to registry** — push to your container registry.
4. **Migrate DB** — run `npx prisma migrate deploy` against the production
   PostgreSQL database.
5. **Deploy in order** — AI engine first, then backend (depends on AI engine),
   then frontend (depends on backend).
6. **Health checks** — verify:
   - `GET http://<ai-engine>/health` → `{"status":"healthy"}`
   - `GET http://<backend>/api/auth/me` → `401` (expected — means the server is
     up and responding; it rejects unauthed requests correctly)
   - Frontend loads at `http://<frontend>`
7. **Smoke test** — send a test chat message through the advisor UI.

---

## 8. Rollback Procedure

### Application rollback

1. Identify the last known-good image tag.
2. Re-deploy the previous image tag to all affected services (reverse the deploy
   order: frontend → backend → AI engine).
3. Verify health checks pass.

### Database rollback

> Migration rollback in Prisma requires manual down-migration SQL. This must be
> prepared alongside each migration before it ships.

```bash
# Undo the last migration (requires a manually written down.sql):
psql aegis_db < migrations/YYYYMMDD_description/down.sql

# Verify schema matches the previous state:
npx prisma db pull
```

Preventive measure: always snapshot the database before deploying a migration.

---

## 9. Monitoring & Health Checks

| Probe | Endpoint | Expected | Notes |
|---|---|---|---|
| AI Engine liveness | `GET /health` | `200 {"status":"healthy"}` | Public; safe for load balancers |
| AI Engine readiness | `GET /api/ai/environments/health` | `200` all environments | Requires `X-Internal-Api-Key` |
| Backend liveness | `GET /api/auth/me` | `401` (server is up) | Any HTTP response confirms the process is alive |
| Frontend | HTTP 200 on root | `200` | CDN / proxy health |

**Recommended monitoring stack:**
- Uptime probes on the liveness endpoints (e.g. UptimeRobot, Grafana Cloud).
- Application-level error rate alerts (5xx responses).
- LLM cost monitoring via provider dashboards (Gemini / OpenAI usage pages).
- Log aggregation for structured server logs (the backend uses `morgan`; the AI
  engine uses the `logging` module configured in `app/utils/logger.py`).

---

## 10. Production Hardening Checklist

This checklist supplements [SECURITY.md](SECURITY.md). Review before each
production deployment.

- [ ] `JWT_SECRET` is ≥ 32 characters, high-entropy, and not one of the
      known-weak patterns (`secret`, `changeme`, `password`, …).
- [ ] `AI_INTERNAL_API_KEY` is set and **identical** on both backend and AI
      engine.
- [ ] `COOKIE_SECURE=true` in backend (requires HTTPS).
- [ ] `ENVIRONMENT=production` in AI engine (disables `/docs`).
- [ ] `NODE_ENV=production` in backend (disables Morgan dev logging, enables
      production error handling).
- [ ] `CLIENT_URL` / `ALLOWED_ORIGINS` are exact production URLs — no wildcards.
- [ ] `TRUST_PROXY` set to the correct number of front proxies — not `true`.
- [ ] PostgreSQL `DATABASE_URL` pointing to the managed Postgres instance — not
      SQLite.
- [ ] TLS terminated at the load balancer / reverse proxy; HSTS header is sent
      by Helmet (`max-age=31536000`).
- [x] Uploads scoped to their owner (`UploadedDocument.ownerId`).
- [x] SSE stream proxied through the backend; the AI engine requires the
      internal key on every route — see [SECURITY.md §1](SECURITY.md).
- [ ] **AI engine port is not publicly reachable.** The proxy is the control;
      the shared key is what is left if the network is not.
- [ ] CSRF protection implemented for cookie-auth state-changing routes — see
      [SECURITY.md §13](SECURITY.md).
- [ ] Dependency scanning automated (npm audit, pip-audit or Safety).
- [ ] Centralised log collection and alerting configured.
- [ ] Database backups verified (automated, encrypted, point-in-time).
- [ ] `dev.db`, `.env`, `node_modules`, `venv`, `__pycache__` confirmed absent
      from all container images.
