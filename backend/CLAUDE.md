# Backend — Coding Standards

Applies to `backend/` (Node.js + Express + Prisma, strict TypeScript).
Repo-wide rules are in the root [CLAUDE.md](../CLAUDE.md).

- Route → `validateBody` → controller → service → Prisma. Keep that order.
- Wrap async handlers in `catchAsync`; throw `AppError` for operational errors.
- Never leak stack traces or internal errors to clients in production.
