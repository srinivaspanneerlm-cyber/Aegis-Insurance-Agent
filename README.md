# Aegis AI — Enterprise Insurance Platform

> Aegis AI is a **next-generation multi-agent insurance platform** that educates,
> guides, and protects customers — not just sells policies. Five specialist AI
> advisors and an Executive Manager work together to deliver empathetic,
> personalised insurance experiences in plain language.
>
> **See also:** [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_AGENTS.md](AI_AGENTS.md) ·
> [API_REFERENCE.md](API_REFERENCE.md) · [DEPLOYMENT.md](DEPLOYMENT.md) ·
> [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md) ·
> [CHANGELOG.md](CHANGELOG.md) · [UI_GUIDELINES.md](UI_GUIDELINES.md) ·
> [CLAUDE.md](CLAUDE.md) · [PROJECT_RULES.md](PROJECT_RULES.md)

---

## 1. Mission

**Educate. Guide. Protect.**

Insurance products historically underserve the people who need them most. Aegis AI
is built specifically for them:

| Audience | Design intent |
|---|---|
| Middle / lower-middle-class families | Plain language, budget-first framing |
| First-time buyers | Explain jargon; never assume prior knowledge |
| Senior citizens | Large hit-areas, calm tone, low cognitive load |
| Rural users | Low-bandwidth friendly, voice-first capable |
| Tamil / Thanglish / English speakers | Multilingual, code-switching tolerant |

Every product and engineering decision is measured against this mission. **Clarity,
trust, and accessibility outrank cleverness.**

---

## 2. Vision

A fully autonomous, transparent, and fair insurance advisor in every pocket —
one that advocates for the customer, not the insurer. Post-sale agents (Claims,
Renewal, Payment, Policy Management) complete the lifecycle so no customer has to
navigate a bureaucratic maze alone.

---

## 3. Feature Highlights

- **Multi-agent AI** — Sarah (Health), Alex (Motor), Emma (Property), Ethan (Travel),
  Executive Manager AI, all orchestrated by `CentralOrchestrator`.
- **Voice-first advisor** — streaming SSE with waveform UI, Web Speech API, and
  Text-to-Speech in the browser; multilingual (en-IN).
- **Holographic recommendation cards** — structured `[RECOMMENDATION:...]` payloads
  rendered as domain-coloured plan cards with comparison buttons.
- **Layered memory engine** — per-customer, per-domain conversation history and
  profiles persisted under `Aegis-AI/layer3/`.
- **Consent-based agent transfer** — users are prompted before topic switches;
  workflows snapshot for resumption.
- **JWT + RBAC auth** — httpOnly cookie, three-tier roles (`customer` / `admin` /
  `superadmin`), rate-limited endpoints.
- **Provider-agnostic LLM** — Ollama, Gemini, or OpenAI selected via
  `DEFAULT_PROVIDER`; no provider hardcoded.
- **Admin dashboard** — real-time stats, user management, lead management, and
  AI monitoring.

---

## 4. Tech Stack

| Layer | Runtime | Key dependencies |
|---|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS | framer-motion, lucide-react, socket.io-client, axios |
| Backend | Node.js ≥ 18 · Express · Prisma 5 | bcrypt, jsonwebtoken, helmet, cors, multer, socket.io |
| AI Engine | Python 3.13 · FastAPI · Pydantic v2 | uvicorn, google-generativeai, openai |
| Knowledge Base | JSON data + rules (layers 1–5) | File-backed; consumed by Python agents |
| Database | SQLite (dev) → PostgreSQL (prod) | Via Prisma ORM only |
| Realtime | Socket.io (chat) + SSE (voice/stream) | JWT-authenticated |

---

## 5. Monorepo Structure

```
salesbots/
├── Aegis-AI/              # Layered rule/data knowledge base
│   ├── layer1/            # Domain facts: health, motor, travel, home-property, executive
│   ├── layer2/            # Routing: advisor_router, category_router, decision_engine
│   ├── layer3/            # Memory: conversations, customer profiles, rec-context, state
│   ├── layer4/            # Recommendation: scoring, risk, comparison, policy_matcher
│   └── layer5/            # Executive: approval_engine, executive_analytics, memory
│
├── ai-python/             # FastAPI multi-agent AI engine ("the brain")
│   ├── main.py            # App factory, route mounting, health probes
│   └── app/
│       ├── agents/        # sarah_ai, alex_ai, emma_ai, ethan_ai, executive_ai, base_agent
│       ├── orchestrator/  # CentralOrchestrator, EnvironmentRegistry, IntentRouter, sessions
│       ├── intent/        # IntentDetectionEngine
│       ├── memory/        # MemoryOrchestrator, conversation_store, profile_manager, rec-cache
│       ├── services/      # chat_service, stream_service, ui_action_engine, llm_service
│       ├── routes/        # chat_routes, stream_routes, action_routes, health_routes
│       ├── middleware/    # internal_auth
│       └── models/        # Pydantic schemas (ChatRequest, ChatResponse, UIAction*)
│
├── backend/               # Node.js Express API (auth, RBAC, leads, policies, bridge)
│   ├── prisma/            # schema.prisma, seed.js, dev.db (gitignored)
│   └── src/
│       ├── app.js         # Middleware chain + route mounting
│       ├── server.js      # HTTP + Socket.io bootstrap
│       ├── routes/        # auth, leads, policies, chat, upload, company, admin, ui_action
│       ├── controllers/   # Request handlers
│       ├── services/      # ai.service.js (bridge + resilient fallback)
│       ├── middleware/    # auth, validate, error
│       ├── config/        # env (fail-fast), security (CORS, limiters), db
│       ├── validations/   # schemas.js (hand-rolled body validators)
│       └── sockets/       # Socket.io event wiring (JWT-authenticated)
│
└── frontend/              # Next.js consumer + admin UI
    └── src/
        ├── app/           # Route segments: login, admin-login, advisor, policies, purchase …
        ├── components/    # AIChatMessage, VoiceEngine, ThinkingEngine, TransferDialog …
        ├── context/       # AuthContext, ThemeContext (dark/light, key: aegis_theme)
        ├── hooks/         # useStreaming, useVoice
        └── services/      # api.ts (axios, withCredentials)
```

---

## 6. Quick-Start (Local Development)

### Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| Python | 3.11 (3.13 preferred) |
| pip | Latest |
| Git | Any recent |

### Step 1 — Clone

```bash
git clone <repository-url> salesbots
cd salesbots
```

### Step 2 — AI Engine (`ai-python`)

```bash
cd ai-python

# Create and activate virtualenv
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set DEFAULT_PROVIDER and the matching provider key(s)

# Start (reload mode)
python main.py
# or: bash start.sh
```

Endpoints available at `http://localhost:8000`
Swagger docs (dev only): `http://localhost:8000/docs`

### Step 3 — Backend (`backend`)

```bash
cd backend

npm install

# Configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET (≥ 32 chars) and AI_INTERNAL_API_KEY

# Initialise the database (dev: SQLite)
npm run db:push       # applies prisma/schema.prisma → dev.db
node prisma/seed.js   # seeds reference companies & policies

# Start development server
npm run dev
```

API available at `http://localhost:5000`

### Step 4 — Frontend (`frontend`)

```bash
cd frontend

npm install

# Configure environment
cp .env.example .env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:5000/api

npm run dev
```

App available at `http://localhost:3000`

---

## 7. Environment Variables

All environment files are gitignored. Copy `.env.example` → `.env` in each
service directory and fill in real values.

### `ai-python/.env` (key variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | FastAPI port |
| `HOST` | `0.0.0.0` | FastAPI bind host |
| `ENVIRONMENT` | `development` | `development` \| `production` (controls docs exposure) |
| `DEFAULT_PROVIDER` | `ollama` | LLM provider: `ollama` \| `gemini` \| `openai` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint (`https://ollama.com` for Ollama Cloud) |
| `OLLAMA_MODEL` | `gpt-oss:20b` | Ollama model name |
| `OLLAMA_API_KEY` | `ollama` | Ollama key (your ollama.com key for Cloud) |
| `GEMINI_API_KEY` | — | Required only when `DEFAULT_PROVIDER=gemini` |
| `OPENAI_API_KEY` | — | Required only when `DEFAULT_PROVIDER=openai` |
| `AI_INTERNAL_API_KEY` | — | Shared key — must match backend's value |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | CORS allowlist |

### `backend/.env` (key variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express port |
| `NODE_ENV` | `development` | `development` \| `production` |
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string |
| `JWT_SECRET` | — | **Required, ≥ 32 chars, high-entropy** |
| `JWT_EXPIRES_IN` | `30d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:3000` | Frontend origin (CORS) |
| `COOKIE_SECURE` | `false` | Set `true` in production (HTTPS only) |
| `AI_SERVICE_URL` | `http://localhost:8000/api/ai` | AI engine integration URL |
| `AI_INTERNAL_API_KEY` | — | Shared key — must match AI engine's value |
| `TRUST_PROXY` | `false` | Number of front proxies; never `true` |

### `frontend/.env.local` (key variables)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Backend REST base URL (browser-visible) |

Full variable documentation: see the `.env.example` files in each service
directory. See [SECURITY.md](SECURITY.md) for secrets management rules.

---

## 8. Database Setup

```bash
cd backend

# Development (SQLite — schema push, no migration history)
npm run db:push
node prisma/seed.js

# View data
npm run db:studio    # Opens Prisma Studio at http://localhost:5555

# Production (PostgreSQL — versioned migrations)
# Set DATABASE_URL to your Postgres connection string in .env, then:
npx prisma migrate deploy
```

See [DATABASE.md](DATABASE.md) for the full data model, scaling path, and
backup procedures.

---

## 9. Development Workflow

1. **Read [CLAUDE.md](CLAUDE.md) first** — it is the engineering charter.
2. Start services in order: AI engine → backend → frontend.
3. Before changing code, verify no protected workflows are affected (see
   [CLAUDE.md §2](CLAUDE.md)).
4. After any change, run the validation checklist from [CLAUDE.md §10](CLAUDE.md).
5. Commit only when asked; stage specific files; never commit `.env` or `dev.db`.

---

## 10. Contribution Guide

1. Read [CLAUDE.md](CLAUDE.md), [PROJECT_RULES.md](PROJECT_RULES.md), and the
   section of [ARCHITECTURE.md](ARCHITECTURE.md) relevant to your change.
2. Work in a feature branch off `main`.
3. Follow the naming conventions in [PROJECT_RULES.md §1](PROJECT_RULES.md).
4. Apply the coding standards for your layer (TypeScript / Node / Python).
5. Run the validation workflow ([CLAUDE.md §10](CLAUDE.md)) before opening a PR.
6. Update the affected doc (API_REFERENCE, DATABASE, AI_AGENTS, etc.) in the
   same PR — documentation is part of the definition of done.
7. Commit message: imperative subject, body explaining **why**, ending with
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## 11. Roadmap — Future Agents

The following agents are planned. Each will inherit `BaseInsuranceAgent`,
register through `EnvironmentRegistry`, and follow all consent-based transfer
rules. See [AI_AGENTS.md §9](AI_AGENTS.md) for the full expansion checklist.

| Agent | Purpose |
|---|---|
| **Knowledge AI** | Deep insurance education and Q&A for first-time buyers |
| **Claims AI** | End-to-end claims guidance and triage |
| **Renewal AI** | Proactive renewals and lapse prevention |
| **Document Verification AI** | KYC and document authenticity |
| **Payment AI** | Secure premium collection and receipts |
| **Policy Management AI** | Policy lifecycle: issue, endorse, cancel |
| **Fraud Detection AI** | Risk and anomaly detection |
| **Recommendation AI** | Cross-domain, portfolio-level advice |
| **Customer Success AI** | Retention, education, and satisfaction |
| **Voice Layer** | First-class multilingual voice (Tamil / Thanglish / English) |

---

## 12. Links

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full system design, data flows, Mermaid diagrams |
| [AI_AGENTS.md](AI_AGENTS.md) | Per-agent detail, memory model, transfer rules |
| [API_REFERENCE.md](API_REFERENCE.md) | All REST endpoints with request/response shapes and curl examples |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build, run, environment matrix, Docker, rollback |
| [DATABASE.md](DATABASE.md) | Schema, ER diagram, migrations, scaling path |
| [SECURITY.md](SECURITY.md) | Auth, RBAC, OWASP alignment, hardening backlog |
| [UI_GUIDELINES.md](UI_GUIDELINES.md) | Color system, typography, chat/voice UI, accessibility |
| [CHANGELOG.md](CHANGELOG.md) | Version history, breaking changes |
| [CLAUDE.md](CLAUDE.md) | Engineering charter — read before touching any code |
| [PROJECT_RULES.md](PROJECT_RULES.md) | Naming, coding, git, and testing conventions |
