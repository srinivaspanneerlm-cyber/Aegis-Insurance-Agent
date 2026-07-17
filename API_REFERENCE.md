# API_REFERENCE.md — Aegis AI REST API

> Complete endpoint reference for the Aegis AI platform. Two services expose
> HTTP APIs: the **Backend** (Node.js / Express, port 5000) and the
> **AI Engine** (FastAPI / Python, port 8000). All backend routes are prefixed
> with `/api`; all AI engine routes with `/api/ai` (or root-level health checks).
>
> **See also:** [ARCHITECTURE.md](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) ·
> [DATABASE.md](DATABASE.md) · [CLAUDE.md](CLAUDE.md)

---

## 1. Authentication

### 1.1 Cookie Auth (primary — browser clients)

The backend sets an **httpOnly cookie** (`aegis_token`) on successful login or
registration. The frontend never reads this cookie from JavaScript (`AuthContext`
calls `GET /api/auth/me` instead). All credentialed requests require
`withCredentials: true` (or `credentials: "include"` for native `fetch`).

### 1.2 Bearer Token (fallback — API / non-browser clients)

The JWT is also returned in the login/register response body for API clients
that cannot use cookies. Pass it as:

```
Authorization: Bearer <token>
```

### 1.3 Internal Service Auth (Backend → AI Engine)

Routes on the AI Engine that are gated for internal use only require:

```
X-Internal-Api-Key: <AI_INTERNAL_API_KEY>
```

This key is set identically on both services. Comparison is constant-time.
In production, if the key is unset, the gated routes return `503`.

**Every AI Engine route requires it**, streaming included. The engine resolves
the `user_name` it is given straight to that customer's profile and conversation
memory, so a caller who could reach it directly could name any customer and read
and write their data. The browser therefore never addresses the engine: it posts
to the backend's `POST /api/chat/stream`, which authenticates the customer,
applies `aiLimiter`, and proxies the stream back.

---

## 2. Authorization (RBAC)

| Role | Granted by | Description |
|---|---|---|
| `customer` | Public registration (always) | Can chat, submit leads, upload, view policies |
| `admin` | Admin flow / DB seed | All customer capabilities + lead management, stats |
| `superadmin` | DB seed / promote script | All admin capabilities + company create, lead delete |

The real authorization boundary is the backend `restrictTo(role)` middleware —
frontend route guards are UX only.

---

## 3. Standard Response Envelope

All successful backend responses follow:

```json
{ "status": "success", "data": { ... } }
```

List responses add a `results` count:

```json
{ "status": "success", "results": 3, "data": { "items": [...] } }
```

Error responses:

```json
{ "status": "error" | "fail", "message": "Human-readable reason." }
```

In production, stack traces and internal detail are never returned to the client.

---

## 4. Rate Limits

| Limiter | Scope | Window | Max requests |
|---|---|---|---|
| `apiLimiter` | All `/api` routes | 15 min | 100 |
| `authLimiter` | `/api/auth/register`, `/api/auth/login` | 1 hour | 20 |
| `aiLimiter` | `/api/chat` (POST), `/api/chat/stream` (POST), `/api/ui-action` (POST) | 1 min | 20 |

Exceeding a limit returns HTTP `429 Too Many Requests`.

---

## 5. Backend REST Endpoints

Base URL: `http://localhost:5000` (dev) or your production hostname.
All routes listed below are relative to that base; the `/api` prefix is always
present (mounted in `backend/src/app.js`).

---

### 5.1 Auth — `/api/auth`

Rate-limited by `authLimiter` (20 req / hr) on register and login.

#### `POST /api/auth/register`

Create a new customer account. Role is always set to `customer` server-side —
it cannot be elevated via the request body.

**Auth required:** No  
**Rate limit:** `authLimiter`

**Request body:**
```json
{
  "name": "Priya Kumar",
  "email": "priya@example.com",
  "password": "securePass123"
}
```

**Validation rules:**
- `name`: string, ≥ 2 characters
- `email`: valid email format
- `password`: 6–72 bytes (72-byte cap prevents bcrypt truncation / hashing-DoS)

**Response `201`:**
```json
{
  "status": "success",
  "token": "<jwt>",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Priya Kumar",
      "email": "priya@example.com",
      "role": "customer",
      "createdAt": "2026-07-11T10:00:00.000Z"
    }
  }
}
```

Sets `aegis_token` httpOnly cookie.

**Errors:**
- `400` — validation failure or email already registered

---

#### `POST /api/auth/login`

**Auth required:** No  
**Rate limit:** `authLimiter`

**Request body:**
```json
{
  "email": "priya@example.com",
  "password": "securePass123"
}
```

**Response `200`:** same shape as register; sets `aegis_token` cookie.

**Errors:**
- `401` — incorrect email or password (anti-enumeration: timing is constant)

---

#### `POST /api/auth/logout`

**Auth required:** No (clears cookie regardless)

**Response `200`:**
```json
{ "status": "success", "message": "Logged out." }
```

Clears the `aegis_token` cookie.

---

#### `GET /api/auth/me`

Return the currently authenticated user. Used by the frontend to resolve session
on page load.

**Auth required:** Yes (`protect`)

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "user": { "id": "uuid", "name": "...", "email": "...", "role": "customer", "createdAt": "..." }
  }
}
```

**Errors:**
- `401` — no valid token

---

### 5.2 Leads — `/api/leads`

#### `POST /api/leads`

Submit a prospect lead. Available to authenticated customers.

**Auth required:** Yes (`protect`)  
**Rate limit:** `apiLimiter`

**Request body:**
```json
{
  "customerName": "Ramesh Sundaram",
  "email": "ramesh@example.com",
  "phone": "9876543210",
  "insuranceType": "health",
  "budget": "5000"
}
```

**Validation rules:**
- `customerName`: string ≥ 2 characters
- `email`: valid format
- `phone`: string ≥ 8 characters
- `insuranceType`: string, required
- `budget`: string, required

**Response `201`:**
```json
{
  "status": "success",
  "data": { "lead": { "id": "uuid", "customerName": "...", "status": "pending", ... } }
}
```

Status is set to `"approved"` automatically ~5 seconds later (simulated
underwriting pipeline).

---

#### `GET /api/leads`

List all leads. Admin only.

**Auth required:** Yes · **Roles:** `admin`, `superadmin`

**Response `200`:**
```json
{ "status": "success", "results": 12, "data": { "leads": [...] } }
```

---

#### `GET /api/leads/:id`

Fetch a single lead by ID.

**Auth required:** Yes · **Roles:** `admin`, `superadmin`

**Response `200`:**
```json
{ "status": "success", "data": { "lead": { ... } } }
```

**Errors:**
- `404` — lead not found

---

#### `PUT /api/leads/:id`

Update lead fields (status, contact details, etc.).

**Auth required:** Yes · **Roles:** `admin`, `superadmin`

**Request body:** any subset of `customerName`, `email`, `phone`,
`insuranceType`, `budget`, `status`.

**Response `200`:**
```json
{ "status": "success", "data": { "lead": { ... } } }
```

---

#### `DELETE /api/leads/:id`

Hard delete a lead.

**Auth required:** Yes · **Roles:** `superadmin` only

**Response `204`** (no body)

---

### 5.3 Policies — `/api/policies`

#### `GET /api/policies`

List all insurance policies (includes company branding).

**Auth required:** No

**Response `200`:**
```json
{
  "status": "success",
  "results": 5,
  "data": {
    "policies": [
      {
        "id": "uuid",
        "policyName": "Family Health Shield",
        "premium": 12500.0,
        "coverage": "₹10 Lakhs",
        "companyId": "uuid",
        "company": { "companyName": "Aegis Assurance", "logo": "url" }
      }
    ]
  }
}
```

---

#### `GET /api/policies/:id`

Fetch a single policy.

**Auth required:** No

**Response `200`:**
```json
{ "status": "success", "data": { "policy": { ... } } }
```

**Errors:**
- `404` — policy not found

---

#### `POST /api/policies`

Create a new insurance policy product.

**Auth required:** Yes · **Roles:** `admin`, `superadmin`

**Request body:**
```json
{
  "policyName": "Family Health Shield",
  "premium": 12500.0,
  "coverage": "₹10 Lakhs",
  "companyId": "<uuid of an existing company>"
}
```

**Validation rules:**
- `policyName`: string, required
- `premium`: positive number
- `coverage`: string, required
- `companyId`: string (UUID), must reference an existing company

**Response `201`:**
```json
{ "status": "success", "data": { "policy": { ... } } }
```

**Errors:**
- `404` — company not found

---

### 5.4 Chat — `/api/chat`

All chat routes require `protect`. POST additionally requires `aiLimiter`
(20 req / min — protects paid LLM cost).

#### `POST /api/chat`

Send a message to the Aegis AI multi-agent system. The backend saves both the
customer and advisor turns, then proxies to the AI engine via `ai.service.js`.

**Auth required:** Yes · **Rate limit:** `aiLimiter`

**Request body:**
```json
{
  "message": "I need health insurance for my family of 4 with a budget of ₹8,000/month",
  "product_type": "health",
  "session_id": "sess_abc123"
}
```

Fields:
- `message` (required): the customer's text
- `product_type` (optional): hint for routing (`health` | `motor` | `travel` |
  `home-property` | `miscellaneous`)
- `session_id` (optional): resume an existing conversation context

**Response `201`:**
```json
{
  "status": "success",
  "data": {
    "customerMessage": { "id": "uuid", "message": "...", "sender": "customer", ... },
    "advisorMessage":  { "id": "uuid", "message": "...", "sender": "advisor", "agentName": "Sarah AI", ... },
    "agentName": "Sarah AI",
    "transferred": false,
    "sessionId": "sess_abc123"
  }
}
```

---

#### `POST /api/chat/stream`

The advisor's SSE stream. This is the browser's entry point for the
streaming/voice workflow — it proxies `/api/ai/chat/stream` on the AI Engine,
which the browser cannot reach.

**Auth required:** Yes (`protect`)  
**Rate limit:** `aiLimiter` — the same paid LLM sits behind it as `POST /api/chat`

**Request body:**
```json
{
  "message": "I need family health insurance",
  "history": [{ "role": "user", "content": "Hi" }],
  "product_type": "health",
  "session_id": "sess_abc123",
  "force_transfer_to": null,
  "declined_domains": ["motor"]
}
```

**`user_name` is not accepted.** The backend supplies it from the verified
session; the engine resolves it to that customer's profile and conversation
memory, so it is not the caller's to assert. Anything the body claims about
identity is dropped.

**Response:** `Content-Type: text/event-stream` — the AI Engine's SSE events,
passed through unparsed. See `POST /api/ai/chat/stream` for the event shapes.

Closing the connection aborts the upstream call rather than leaving it billing.
Upstream failures arrive in-band as an `error` event, since the SSE headers are
already sent by the time one can happen.

---

#### `GET /api/chat`

Retrieve chat history for the authenticated user.

**Auth required:** Yes

**Query params:**
- `session_id` (optional): filter by session

**Response `200`:**
```json
{
  "status": "success",
  "results": 24,
  "data": { "chat": [ { "id": "...", "message": "...", "sender": "customer" | "advisor", ... } ] }
}
```

History is always scoped to the authenticated user (`userId`) — no cross-tenant
leakage. Capped at 200 most-recent messages.

---

### 5.5 Upload — `/api/upload`

#### `POST /api/upload`

Upload a KYC or policy document. Single file, multipart form-data.

**Auth required:** Yes

**Request:** `multipart/form-data`, field name `file`

Allowed types (extension AND MIME must both match):
- `.pdf` / `application/pdf`
- `.docx` / `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Limits: 10 MB per file, 1 file per request.

**Response `201`:**
```json
{
  "status": "success",
  "data": { "document": { "id": "uuid", "filename": "kyc-doc.pdf", "filepath": "...", "uploadedAt": "..." } }
}
```

**Errors:**
- `400` — no file, disallowed extension, or mismatched MIME type

---

#### `GET /api/upload`

List all uploaded documents.

**Auth required:** Yes

**Response `200`:**
```json
{ "status": "success", "data": { "documents": [...] } }
```

---

#### Static: `GET /uploads/<filename>`

Serve a specific uploaded file.

**Auth required:** Yes (`protect` middleware gates the static path)  
Dotfiles are denied. Filenames are generated server-side (not user-controlled).

---

### 5.6 Company — `/api/company`

All company routes require `protect`.

#### `GET /api/company`

List all insurance companies.

**Auth required:** Yes

**Response `200`:**
```json
{ "status": "success", "results": 3, "data": { "companies": [...] } }
```

---

#### `POST /api/company`

Create a new insurer company record.

**Auth required:** Yes · **Roles:** `superadmin` only

**Request body:**
```json
{
  "companyName": "Aegis Assurance Ltd.",
  "logo": "https://cdn.example.com/aegis-logo.png",
  "description": "Trusted insurer since 1998."
}
```

**Response `201`:**
```json
{ "status": "success", "data": { "company": { ... } } }
```

---

### 5.7 Admin — `/api/admin`

#### `GET /api/admin/stats`

Aggregate dashboard statistics.

**Auth required:** Yes · **Roles:** `admin`, `superadmin`

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "totalLeads": 120,
    "totalChats": 3400,
    "uploadedDocuments": 87,
    "activeUsers": 210
  }
}
```

---

### 5.8 UI Action — `/api/ui-action`

Structured button-click events that bypass chat routing (no intent detection,
no recommendation generation). The backend proxies these to the AI engine's
`/api/ai/action` endpoint.

**Auth required:** Yes · **Rate limit:** `aiLimiter`

#### `POST /api/ui-action`

**Request body:**
```json
{
  "type": "ui_action",
  "action": "view_details",
  "session_id": "sess_abc123",
  "session_data": { ... }
}
```

Supported `action` values: `view_details`, `compare_plans`, `select_plan`,
`purchase_plan`, `download_brochure`, `share_plan`, `contact_advisor`,
`schedule_callback`.

**Response `200`:**
```json
{
  "type": "ui_action_response",
  "action": "view_details",
  "session_id": "sess_abc123",
  "status": "success",
  "response_type": "data",
  "data": { ... },
  "message": null
}
```

---

## 6. AI Engine Endpoints

Base URL: `http://localhost:8000` (dev).
Swagger UI (dev only): `http://localhost:8000/docs`

All routes prefixed `/api/ai` require `X-Internal-Api-Key`, streaming included.
Only the health probes are ungated, and they disclose nothing beyond which agent
environments are up.

---

### 6.1 Health

#### `GET /`

Root health check — returns service info.

**Auth required:** No

**Response `200`:**
```json
{
  "status": "online",
  "service": "Aegis AI Insurance Engine",
  "version": "1.0.0",
  "provider": "ollama",
  "docs": "/docs"
}
```

Note: in production, `docs` and `provider` fields may be minimised to avoid
information disclosure.

---

#### `GET /health`

Liveness probe for load balancers and monitoring. Intentionally minimal — never
discloses which providers or keys are configured.

**Auth required:** No

**Response `200`:**
```json
{ "status": "healthy" }
```

---

#### `GET /api/ai/environments/health`

Aggregate health for all five agent environments (health, motor, travel,
home-property, executive).

**Auth required:** Yes (`X-Internal-Api-Key`)

**Response `200`:** structured health report from `EnvironmentRegistry`.

---

#### `GET /api/ai/environments/{domain}/health`

Health for a single environment by domain key.

**Auth required:** Yes (`X-Internal-Api-Key`)

**Path param:** `domain` — one of `health`, `motor`, `travel`, `home-property`,
`executive`.

**Errors:**
- `404` — domain not registered

---

### 6.2 Chat (request/response)

#### `POST /api/ai`

Direct backend integration endpoint. Equivalent to `/api/ai/ai-chat`; kept for
backward compatibility with `ai.service.js`.

**Auth required:** Yes (`X-Internal-Api-Key`)

**Request body (`ChatRequest`):**
```json
{
  "message": "I need family health insurance",
  "history": [
    { "sender": "customer", "message": "Hi" },
    { "sender": "advisor", "message": "Hello! I'm Sarah..." }
  ],
  "user_name": "Priya",
  "product_type": "health",
  "session_id": "sess_abc123",
  "force_transfer_to": null,
  "declined_domains": ["motor"]
}
```

Field constraints (Pydantic v2):
- `message`: 1–8000 characters
- `history`: max 100 items; each item max 8000 chars
- `user_name`: max 200 characters
- `product_type`: max 64 characters
- `session_id`: max 200 characters
- `force_transfer_to`: max 64 characters — only set after user approves a transfer
- `declined_domains`: max 16 items, each max 64 chars — domains the user has
  refused to switch to. Send the full list with **every** message: the refusal
  holds for the whole session, not just the next turn. Interrupt detection still
  runs, but a switch to a declined domain is not offered again and the message
  goes to the active agent instead. Omitting it re-offers a refused switch,
  which the UI suppresses — leaving the suggestion on screen unanswerable.

**Response `200` (`ChatResponse`):**
```json
{
  "reply": "Hello Priya! I'm Sarah, your health insurance advisor...",
  "agent_name": "Sarah AI",
  "agent_domain": "health",
  "transferred": false,
  "suggest_transfer": false,
  "transfer_from": null,
  "transfer_from_name": null,
  "transfer_to": null,
  "transfer_to_name": null,
  "transfer_reason": null,
  "previous_agent": null,
  "session_id": "sess_abc123",
  "is_interrupt": false
}
```

Transfer suggestion example (user changed domain mid-conversation):
```json
{
  "reply": "I see you're asking about your car — shall I connect you with Alex from our Motor team?",
  "agent_name": "Sarah AI",
  "agent_domain": "health",
  "suggest_transfer": true,
  "transfer_to": "motor",
  "transfer_to_name": "Alex AI",
  "transfer_reason": "motor",
  "is_interrupt": true,
  ...
}
```

---

#### `POST /api/ai/ai-chat`

Alias for `/api/ai`. Same request/response shapes. Preferred path for new
integrations.

**Auth required:** Yes (`X-Internal-Api-Key`)

---

#### `POST /ai-chat` (root)

Root-level endpoint on the AI engine. Same contract as above.

**Auth required:** Yes (`X-Internal-Api-Key`)

---

### 6.3 Streaming Chat (SSE)

#### `POST /api/ai/chat/stream`

Server-Sent Events stream for the voice/streaming advisor experience.

**Not called by the browser.** The frontend posts to the backend's
`POST /api/chat/stream`, which authenticates the customer, applies the AI rate
limit, and proxies this stream back. The backend supplies `user_name` from the
verified session — the engine resolves it straight to that customer's profile
and conversation memory, so it is not the caller's to assert.

**Auth required:** Yes (`X-Internal-Api-Key`) — see
[SECURITY.md §1](SECURITY.md)

**Request body:** same `ChatRequest` shape as `/api/ai`.

**Response:** `Content-Type: text/event-stream` stream of SSE events:

```
event: thinking
data: {"step": "Routing to health domain..."}

event: agent_info
data: {"agent_name": "Sarah AI", "agent_domain": "health", "transferred": false}

event: token
data: {"token": "Hello "}

event: token
data: {"token": "Priya! "}

event: done
data: {}
```

Event types: `thinking` · `agent_info` · `token` · `done` · `error`

The frontend `useStreaming` hook and `useVoice` hook consume this stream.

---

### 6.4 UI Action Engine

#### `POST /api/ai/action`

Structured action handler that bypasses chat routing entirely. Called by the
backend's `/api/ui-action` proxy.

**Auth required:** Yes (`X-Internal-Api-Key`)

**Request body (`UIActionRequest`):**
```json
{
  "type": "ui_action",
  "action": "compare_plans",
  "session_id": "sess_abc123",
  "plan_id": "family-health-shield",
  "session_data": { "planName": "Family Health Shield", ... }
}
```

**Response `200` (`UIActionResponse`):**
```json
{
  "type": "ui_action_response",
  "action": "compare_plans",
  "session_id": "sess_abc123",
  "status": "success",
  "response_type": "data",
  "data": { ... },
  "message": null
}
```

**Errors:**
- `400` — `type` is not `"ui_action"`
- `500` — dispatch error

---

## 7. curl Examples

All examples assume local development; replace tokens and URLs for production.

### Register a new user
```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Kumar","email":"priya@example.com","password":"securePass123"}'
```

### Login (get cookie)
```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@example.com","password":"securePass123"}'
```

### Get current user (using cookie)
```bash
curl -b cookies.txt http://localhost:5000/api/auth/me
```

### Send a chat message
```bash
curl -b cookies.txt -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Health insurance for family of 4, budget 8000/month","product_type":"health"}'
```

### Chat directly with AI engine (server-to-server)
```bash
curl -X POST http://localhost:8000/api/ai/ai-chat \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: YOUR_INTERNAL_KEY" \
  -d '{"message":"What health plans suit a family of 4?","user_name":"Priya"}'
```

### Submit a lead
```bash
curl -b cookies.txt -X POST http://localhost:5000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Ramesh S","email":"ramesh@example.com","phone":"9876543210","insuranceType":"motor","budget":"3000"}'
```

### Upload a document
```bash
curl -b cookies.txt -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/kyc.pdf"
```

### AI Engine health check
```bash
curl http://localhost:8000/health
```

---

## 8. Common Error Codes

| HTTP Status | Meaning | When |
|---|---|---|
| `400` | Bad Request | Validation failure, disallowed file type |
| `401` | Unauthorized | Missing / expired / invalid token |
| `403` | Forbidden | Token valid but role not permitted |
| `404` | Not Found | Resource does not exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server fault (detail logged server-side only) |
| `503` | Service Unavailable | AI engine key unset in production (fail-closed) |

---

## 9. Socket.io Events

The backend also exposes a Socket.io namespace for real-time chat. The socket
handshake requires a valid JWT (cookie or `auth.token`).

| Event (client → server) | Payload | Purpose |
|---|---|---|
| `sendMessage` | `{ message, session_id }` | Send a chat message via socket |

| Event (server → client) | Payload | Purpose |
|---|---|---|
| `receiveMessage` | `{ message, sender, agentName, ... }` | Receive AI reply |
| `error` | `{ message }` | Error in socket handler |

The socket path uses the same per-socket throttle as `aiLimiter` (20 msg / min).
