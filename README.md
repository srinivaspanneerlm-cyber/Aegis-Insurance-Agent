# Salesbots / Aegis AI Insurance Platform

## Repository Overview

This mono-repository contains a full insurance AI platform built across multiple components:

- `Aegis-AI/`: Rule-driven, multi-layer insurance reasoning engine with layered routing, memory, decisioning, and governance workflows.
- `ai-python/`: Python FastAPI service that exposes the Aegis AI conversational advisor, integrates directly with Gemini/OpenAI, and orchestrates recommendation and memory layers.
- `backend/`: Node.js Express API server with authentication, lead management, policy management, file upload support, and Socket.io real-time messaging.
- `frontend/`: Next.js 14 application providing the consumer/admin UI, authentication flows, policy dashboards, and advisor experience.

---

## Key Concepts

### Aegis AI Architecture

The platform is designed as a layered insurance intelligence system:

1. `Aegis-AI/layer1/`: Domain knowledge and insurance data for health, motor, travel, home-property, and miscellaneous insurance.
2. `Aegis-AI/layer2/`: Routing and advisor mapping rules, category/subcategory routers, and confidence/escalation policies.
3. `Aegis-AI/layer3/`: Customer memory, profile extraction, state management, and recommendation context engines.
4. `Aegis-AI/layer4/`: Decision/recommendation engine and executive governance layer.
5. `Aegis-AI/layer5/`: Approval, analytics, governance, monitoring, and orchestration modules.

### ai-python Service

- Uses FastAPI to provide a conversational endpoint at `POST /ai-chat` and compatible route `POST /api/ai/ai-chat`.
- Loads a chat orchestration service that performs:
  - intent detection
  - category routing
  - advisor assignment
  - memory retrieval and profile enrichment
  - knowledge retrieval
  - recommendation generation
  - executive review and governance
- Supports direct async integration with Google Gemini and OpenAI.
- Includes fallback and retry logic for provider rate limits and missing profile data.

### Backend Server

- Built with Express.js and Prisma.
- Supports APIs for authentication, leads, policies, chat, uploads, company data, and admin workflows.
- Uses Socket.io for realtime events and connection handling.
- Includes security middleware: `helmet`, `cors`, `express-rate-limit`, and request validation.

### Frontend Application

- Built with Next.js 14, TypeScript, Tailwind CSS, and React.
- Contains consumer and admin views, login/register pages, advisor pages, policy and recommendations pages.
- Uses `AuthContext` and `ThemeContext` for authentication and theme management.
- Integrates with backend APIs and real-time Socket.io connections.

---

## Folder Summary

### `Aegis-AI/`

- `layer1/`: category-specific knowledge data, insurance plan metadata, and FAQ content.
- `layer2/`: mapping and routing rules for advisor selection, category detection, and escalation.
- `layer3/`: memory engine for storing profiles, conversation state, customer intelligence, and recommendation contexts.
- `layer4/`: decision/recommendation engine and governance logic.
- `layer5/`: orchestration, approval, analytics, and monitoring submodules.

### `ai-python/`

- `main.py`: FastAPI application entrypoint.
- `app/config/config.py`: environment and provider configuration.
- `app/routes/chat_routes.py`: AI chat endpoint router.
- `app/services/chat_service.py`: orchestrates conversation flow and decisioning.
- `app/services/llm_service.py`: provider-specific Gemini/OpenAI SDK adapter.
- `app/models/schemas.py`: request and response Pydantic schemas.
- `app/utils/`: utilities such as logging and premium calculation.
- `requirements.txt`: Python dependencies.
- `start.sh`: easy startup script for Linux.

### `backend/`

- `src/app.js`: Express application setup and route mounting.
- `src/server.js`: HTTP server bootstrap and Socket.io initialization.
- `src/routes/`: REST route modules for auth, leads, policies, chat, uploads, company, and admin.
- `src/sockets/`: Socket.io event wiring.
- `src/config/`: security and environment configuration.
- `prisma/`: Prisma schema and seed utilities.
- `package.json`: backend dependency manifest.

### `frontend/`

- `src/app/`: Next.js application routes.
- `src/components/`: shared UI components.
- `src/context/`: theme and authentication context providers.
- `src/services/`: client-side API helpers.
- `public/`: static assets and images.
- `package.json`: frontend dependency manifest.

---

## How to Run the Project

### 1. Start the AI Chat Service (`ai-python`)

```bash
cd ai-python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
bash start.sh
```

Or run directly:

```bash
python main.py
```

Default local endpoint:

- `http://localhost:8000/`
- Swagger docs: `http://localhost:8000/docs`

### 2. Start the Backend API Server (`backend`)

```bash
cd backend
npm install
npm run dev
```

Default local endpoint:

- `http://localhost:5000/`

### 3. Start the Frontend App (`frontend`)

```bash
cd frontend
npm install
npm run dev
```

Default local endpoint:

- `http://localhost:3000/`

---

## Environment Requirements

### `ai-python/.env`

The Python service expects environment values such as:

- `PORT`
- `HOST`
- `DEFAULT_PROVIDER` (`gemini` or `openai`)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`

### `backend/.env`

The Node backend likely requires:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`

(The actual `.env` file contents are not included in this repository.)

---

## Main API Endpoints

### AI Chat Service (`ai-python`)

- `POST /ai-chat`
- `POST /api/ai/ai-chat`
- `POST /api/ai`

### Backend API (`backend`)

- `POST /api/auth` (authentication)
- `POST /api/leads` (lead creation and management)
- `GET /api/policies` (policy catalog)
- `POST /api/chat` (chat messaging flows)
- `POST /api/upload` (file uploads)
- `GET /api/company` (company data)
- `GET /api/admin` (admin controls)

---

## Notes

- The frontend, backend, and AI service are separate deployable components and can run independently for development.
- `ai-python` is the conversational intelligence layer and is the primary consumer of the `Aegis-AI` rule engine.
- The repository appears designed for an insurance SaaS use case with premium advisor flows, policy recommendations, and customer intelligence.

---

## Technologies Used

- Python: FastAPI, Pydantic, Gemini/OpenAI direct SDK integration
- Node.js: Express, Prisma, Socket.io, JWT, bcrypt, helmet
- Frontend: Next.js 14, TypeScript, Tailwind CSS, React
- Data & architecture: JSON-driven insurance knowledge rules, memory engine, recommender engine, executive governance

---

## Recommended Next Steps

1. Review `ai-python/app/services/chat_service.py` for the Aegis AI orchestration flow.
2. Inspect `Aegis-AI/layer3/engine.py` and `Aegis-AI/layer4/engine.py` for memory and decision engines.
3. Verify backend route behavior in `backend/src/routes/` and Socket.io logic in `backend/src/sockets/`.
4. Explore frontend flows in `frontend/src/app/` to understand consumer and admin experiences.
