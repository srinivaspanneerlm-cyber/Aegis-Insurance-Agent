# Frontend — Coding Standards

Applies to `frontend/` (Next.js App Router + React + TypeScript + Tailwind).
Repo-wide rules are in the root [CLAUDE.md](../CLAUDE.md).

- `interface` for props and public shapes; avoid `any` (existing `any` is debt).
- Server/client boundaries explicit (`"use client"` only where needed).
- Data access goes through `src/services/api.ts` (never `fetch` scattered in pages).
- Auth state comes from `AuthContext`; **never** read the JWT from JS (it is an httpOnly cookie).
