# DATABASE.md — Data Model & Persistence

> The authoritative reference for Aegis AI's relational data: models,
> relationships, indexes, the repository layer, migrations, performance, and the
> scaling path from SQLite (development) to PostgreSQL (production).
>
> **See also:** [ARCHITECTURE.md](ARCHITECTURE.md) ·
> [API_REFERENCE.md](API_REFERENCE.md) · [SECURITY.md](SECURITY.md) ·
> [PROJECT_RULES.md](PROJECT_RULES.md)

Aegis AI has **two persistence systems**:
1. **Relational DB** (Prisma) — users, catalogue, leads, chats, documents, plus
   the AI-platform tables (sessions, recommendations, transfers, notifications,
   audit). *This document.*
2. **File-backed AI memory** (`Aegis-AI/layer3/`) — live conversation history &
   customer profiles managed by `MemoryOrchestrator`. See
   [ARCHITECTURE.md §6](ARCHITECTURE.md).

---

## 1. Engine & Access

| Aspect | Development | Production (target) |
|---|---|---|
| Engine | SQLite (`env DATABASE_URL`) | PostgreSQL (same schema) |
| ORM | Prisma Client | Prisma Client |
| IDs | `uuid` (string) | `uuid` |
| Access | **Repository layer only** | Repository layer only |
| Migrations | `prisma migrate` (versioned) | `prisma migrate deploy` |

The **models are portable** — this schema validates unchanged on both SQLite and
PostgreSQL. But the switch is *not* only a connection string, because Prisma's
datasource `provider` is a literal (it cannot be read from `env()`), the
`migration_lock.toml` pins it, and migration SQL is dialect-specific. The real
production procedure:

```bash
# 1. Point at Postgres and switch the provider (rewrites schema.prisma +
#    migration_lock.toml together; run in the prod image build / CI, not committed).
export DATABASE_URL="postgresql://user:pass@host:5432/aegis"
npm run db:provider postgresql          # or DATABASE_PROVIDER=postgresql

# 2. Generate a Postgres migration lineage against a Postgres shadow DB.
#    The models are identical; only the emitted SQL differs from the SQLite set.
npx prisma migrate dev --name init_postgres

# 3. Deploy.
npm run db:migrate:deploy
npm run db:generate
```

The committed default stays SQLite for zero-friction local dev. `npm run
db:provider sqlite` reverts.

---

## 2. Enterprise Field Conventions

Every core model carries a consistent set of operational fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | `uuid` PK | stable identifier |
| `createdAt` / `uploadedAt` / `startedAt` | `DateTime @default(now())` | creation time |
| `updatedAt` / `lastActive` | `DateTime @updatedAt` | last-modified time |
| `deletedAt` | `DateTime?` | **soft delete** marker (present, not yet enforced — see §6) |
| `version` | `Int @default(1)` | **optimistic-locking** token |
| `isActive` | `Boolean @default(true)` | lifecycle flag (identity/catalogue) |

> Soft-delete columns exist on all core models but are **not yet filtered in
> queries** — enabling that would change response behaviour, so it is a
> deliberate, separately-reviewed follow-up. The schema is ready for it today.

---

## 3. Entity-Relationship Model

```mermaid
erDiagram
    USER ||--o{ CHAT : "owns"
    USER ||--o{ UPLOADEDDOCUMENT : "owns"
    USER ||--o{ LEAD : "assigned"
    USER ||--o{ SESSION : "has"
    USER ||--o{ RECOMMENDATIONHISTORY : "has"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDITLOG : "acts"
    COMPANY ||--o{ POLICY : "offers"
    SESSION ||--o{ CHAT : "groups"
    SESSION ||--o{ RECOMMENDATIONHISTORY : "produces"
    SESSION ||--o{ AGENTTRANSFER : "records"
```

**Enforced relationships (FKs):**

| Relation | On delete | Notes |
|---|---|---|
| `Policy.companyId → Company.id` | Cascade | remove a company → its policies go |
| `Chat.userId → User.id` | SetNull | keep the message, drop the owner link |
| `Chat.sessionId → Session.sessionId` | SetNull | conversation grouping |
| `UploadedDocument.ownerId → User.id` | SetNull | document ownership (closes IDOR) |
| `Lead.assignedToId → User.id` | SetNull | staff assignment |
| `Session.userId → User.id` | SetNull | session owner |
| `Notification.userId → User.id` | Cascade | notifications die with the user |
| `AuditLog.actorId → User.id` | SetNull | preserve the audit trail |

All owner-side links are **nullable** so legacy rows (e.g. the 246 pre-existing
chats with `NULL userId`) remain valid — the migration was fully additive.

---

## 4. Models

### 4.1 Core business models
| Model | Purpose | Key fields |
|---|---|---|
| **User** | Identity & auth | `email` (unique), `password` (bcrypt-12), `role`, `isActive` |
| **Company** | Insurer catalogue | `companyName`, `policies[]` |
| **Policy** | Insurance product | `premium`, `coverage`, `companyId` (cascade) |
| **Lead** | Sales pipeline | `status`, `assignedToId` |
| **Chat** | Conversation log | `userId`, `sessionId`, `agentName`, `agentDomain` |
| **UploadedDocument** | File metadata | `ownerId`, `mimeType`, `sizeBytes` |

### 4.2 AI-platform models (prepared, additive)
These support the multi-agent engine, recommendation lifecycle, and governance.
They are **not yet wired** into the (file-backed) AI memory, so no AI workflow
changes — they are ready for the future agents in [AI_AGENTS.md §9](AI_AGENTS.md).

| Model | Purpose |
|---|---|
| **Session** | Session storage (external `sessionId`, active agent, status) |
| **RecommendationHistory** | Every recommendation (domain, plan, score, `profileHash`, payload) |
| **AgentTransfer** | Transfer history (from/to domain+agent, reason, approved) |
| **Notification** | User notifications (type, read state) |
| **AuditLog** | Security/audit trail (actor, action, entity, IP, metadata) |

> Security note: `AuditLog.metadata` stores contextual JSON — **never** plaintext
> secrets or sensitive PII. See [SECURITY.md](SECURITY.md).

---

## 5. Indexes (all implemented)

| Model | Index | Query it serves |
|---|---|---|
| User | `email` unique · `role` · `isActive` · `createdAt` · `deletedAt` | login, RBAC listing |
| Company | `companyName` · `deletedAt` | catalogue |
| Policy | `companyId` · `policyName` · `deletedAt` | product lookup |
| Lead | `(status, createdAt)` · `email` · `assignedToId` · `deletedAt` | admin pipeline |
| Chat | `(userId, createdAt)` · `(sessionId, createdAt)` · `agentDomain` · `deletedAt` | history reads |
| UploadedDocument | `ownerId` · `deletedAt` | owner-scoped listing |
| Session | `(userId, lastActive)` · `status` · `agentDomain` | session lookup |
| RecommendationHistory | `(userId, createdAt)` · `sessionId` · `domain` · `profileHash` | rec history |
| AgentTransfer | `(sessionId, createdAt)` · `toDomain` | transfer audit |
| Notification | `(userId, isRead, createdAt)` · `type` | inbox |
| AuditLog | `(actorId, createdAt)` · `(action, createdAt)` · `(entity, entityId)` | audit search |

Composite indexes match the real access patterns — history is always read
**owner-first, time-ordered**; leads/notifications **status/state-first**.

---

## 6. Repository Layer (data-access abstraction)

Controllers and services depend on **repositories**, never on the Prisma client
directly (Repository Pattern, [PROJECT_RULES.md §5](PROJECT_RULES.md)).

```
backend/src/repositories/
├── base.repository.js   # generic CRUD + pagination + soft-delete + optimistic lock
└── index.js             # singletons: user, chat, lead, policy, company, document
```

`BaseRepository` provides `findById`, `findUnique`, `findFirst`, `findMany`,
`count`, `paginate` (bounded, max 100/page), `create`, `update`, `updateWhere`,
`delete`, and `softDelete`. Specialised repositories add domain reads such as
`userRepository.findByEmail`, `chatRepository.findRecentByUser`, and
`documentRepository.findByOwner`.

**Benefits:** one place to add caching, soft-delete enforcement, or a datastore
swap; consistent pagination; no scattered Prisma calls.

---

## 7. Migrations

The database uses **versioned Prisma migrations** (not ad-hoc `db push`).

```
backend/prisma/migrations/
├── migration_lock.toml
└── 00000000000000_init/
    └── migration.sql        # baseline (all tables + indexes + FKs)
```

```bash
# Development — create & apply a new migration after editing schema.prisma
npm run db:migrate            # prisma migrate dev

# Production — apply pending migrations non-interactively
npm run db:migrate:deploy     # prisma migrate deploy

# Utilities
npm run db:migrate:status     # show migration state
npm run db:generate           # regenerate the Prisma client
npm run db:seed               # seed reference data
npm run db:studio             # inspect data
```

**Rule:** every schema change is a migration under source control, updates this
document, and is verified against a data-populated database.

---

## 8. Backups & Data Safety

- `dev.db` and any `*.db.bak-*` snapshots are **gitignored** (real user data).
- Take a snapshot before destructive operations:
  `cp backend/prisma/dev.db backend/prisma/dev.db.bak-<timestamp>`.
- Production: automated, encrypted, point-in-time backups (managed Postgres).
- Schema changes are always preceded by a backup and verified (row-count checks)
  afterward.

---

## 9. Performance & Scalability Path

**Done in this layer**
- ✅ Composite indexes on every real query path (§5)
- ✅ Repository layer with bounded pagination (no unbounded scans)
- ✅ FK relations + cascade/set-null rules for referential integrity
- ✅ Parallelised aggregate reads (e.g. admin dashboard uses `Promise.all`)
- ✅ Provider-portable schema (SQLite → Postgres via env)

**Production scaling (next)**
1. **Migrate to PostgreSQL** — concurrency, native indexing, managed backups.
2. **Connection pooling** (PgBouncer / Prisma Data Proxy).
3. **Read replicas** for read-heavy dashboards & history.
4. **Partition-ready** high-volume tables (Chat, AuditLog) by time.
5. **Vector store** for the knowledge layer as retrieval scales.
6. **Enforce soft delete** in a reviewed pass (schema already supports it).

None of these change business behaviour — they are integrity & performance
improvements.

---

## 10. Data Classification

| Data | Sensitivity | Handling |
|---|---|---|
| Passwords | Critical | bcrypt-12, never returned in responses |
| Chat content (health/financial) | High | tenant-scoped by `userId` |
| Customer profiles (Layer 3) | High | namespaced per customer |
| Uploaded documents | High | owner-scoped (`ownerId`); admins may list all |
| Leads (PII) | High | admin-only access |
| Audit logs | Medium | no secrets/plaintext PII stored |
| Policies / Companies | Public-ish | readable to authenticated users |

Retention, right-to-erasure, and consent flows should be formalised before
production launch (they pair naturally with the soft-delete columns).
