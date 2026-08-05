# Aegis Monorepo — Architecture (Sprint 1)

The foundation for five front-ends and four services sharing one design system,
one type system and one identity model. **No business logic lives here yet** —
that is deliberate, and it is what makes the shape reviewable before anything
depends on it.

> **This does not replace `frontend/`, `backend/` or `ai-python/`.** Those are
> the live applications and they are untouched. See [Migration](#migration).

---

## 1. Layout

```
apps/                        Deployable front-ends. No shared code lives here.
  website/            :3100  Public marketing. No session.
  customer-portal/    :3101  Signed-in customers.        principal: customer
  employee-portal/    :3102  Branch staff, daily work.   principal: staff
  enterprise-portal/  :3103  Underwriting & oversight.   principal: staff
  platform-admin/     :3104  Aegis operators.            principal: staff

packages/                    Shared code. Never deployed on its own.
  design-system/             Tokens + Tailwind preset + theme.css
  ui/                        React components built on those tokens
  auth/                      Identity CONTRACTS (types only, no implementation)
  shared-types/              API envelope, Result, branded ids
  utils/                     cn, invariant, env readers, formatters
  tsconfig/                  Shared TypeScript bases
  eslint-config/             Shared flat ESLint configs

services/                    Node processes.
  auth-service/       :4001  Owns both identity realms; the only session minter
  notification-service/:4002 Event consumer — email/SMS/push
  analytics-service/  :4003  Event consumer — read models
  ai-platform/        :4004  Typed gateway in front of the existing ai-python/
```

**The dependency rule, and it only points one way:**

```
apps  →  packages  →  (nothing)
services  →  packages/{auth,shared-types}
```

An app never imports another app. A package never imports an app. That is the
whole of it, and it is what keeps five front-ends from fusing into one.

---

## 2. The decisions worth arguing about

### Packages ship TypeScript source, not build output

There is no `tsup`, no `turbo`, no build orchestration. Each app lists the
workspace packages in `transpilePackages`, so Next compiles them as if they were
its own files.

The cost is that a non-Next consumer would need its own transpile step. The gain
is that editing a component in `packages/ui` hot-reloads in the app immediately,
with no watch task in between and no stale `dist/` to explain to a new engineer
at 5pm. Build orchestration is worth adding the day a package has a consumer
that cannot transpile — not before.

### Colour lives in CSS, everything else lives in the preset

Colour is the one token family that must change *after* the bundle is built,
because the customer picks the theme. So colour values are CSS custom properties
in `theme.css`, and the scale tokens — type, spacing, radius, shadow, motion —
are in `tailwind-preset.ts`. Each value is written exactly once. `tokens.ts`
exports *names and types*, never a second copy of the values, because two copies
of a colour is two colours eventually.

Channels are stored space-separated (`15 23 42`) rather than as hex, so Tailwind
opacity modifiers work: `bg-surface/60`. A hex value there silently breaks every
alpha in the codebase.

### Variants live outside the client boundary

`buttonVariants` and `cardVariants` are in `packages/ui/src/variants.ts`, which
has no `"use client"`. A `cva` definition is pure data, and keeping it beside the
component put it behind the client boundary — a server component calling
`buttonVariants()` then failed at *prerender*. This was caught by the first
production build of this sprint, on the 404 page. Splitting them lets a server
component style a link like a button without shipping React state.

### Two principals, not one `role` string

`packages/auth` models `CustomerPrincipal` and `StaffPrincipal` as **different
types**, with different session policies and different cookie names.

Today's live backend has one `User` table with `role: "customer" | "admin" |
"superadmin"`, which means a string comparison is the only barrier between
public self-registration and administrative access — and it forces one session
policy onto two populations whose needs genuinely conflict. Customers need a
long forgiving session with silent renewal; staff need a short one behind MFA.

Sprint 1 ships the **contract only**, no implementation. This is the one
decision that is genuinely expensive to change later, so the shape is worth
agreeing before anything is built on it.

### Permissions, not roles

`hasPermission(granted, "claim.settle")` — never `role === "admin"`. Roles are
named bundles in `ROLE_PERMISSIONS` and carry no authority of their own. A new
role becomes a data change instead of a hunt through every call site.

### Strict TypeScript means the three flags past `strict`

`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
The first alone prevents most "cannot read property of undefined" in list code.
Branded ids (`CustomerId` vs `PolicyId`) make passing the wrong identifier a
compile error rather than a cross-tenant read.

---

## 3. Commands

```bash
pnpm install            # once, from the repo root
pnpm typecheck          # all 16 projects
pnpm lint               # all 16 projects
pnpm format             # Prettier, monorepo only

cd apps/website && pnpm dev     # :3100
cd services/auth-service && pnpm dev
```

`pnpm` is required (workspace protocol). Node ≥ 20.11.

---

## 4. Migration

`frontend/`, `backend/` and `ai-python/` are deliberately **not** in
`pnpm-workspace.yaml`. They install with npm today, and pulling them in would
rewrite their dependency resolution as a side effect of a scaffolding change.
They also have 1,149 passing tests that are the real guarantee this platform
works.

Suggested order, each step its own sprint with its own verification:

1. **`frontend/` → `apps/customer-portal`.** Largest win: it already contains
   the customer portal, and its 531 tests come with it as the safety net.
2. **`backend/` → `services/`,** split by domain as the service layer appears.
3. **`ai-python/`** stays where it is. It is not a TypeScript project and the
   orchestrator is protected code (CLAUDE.md §6). `services/ai-platform` is its
   typed gateway, not its replacement.

Nothing in `apps/` or `packages/` blocks on that migration — new work can start
in the monorepo immediately, against the same API.
