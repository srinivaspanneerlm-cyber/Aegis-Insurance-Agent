# Aegis AI — Phase 4 Frontend Engineering Audit

**Living document.** One row per step; updated as each step lands. Baseline was
taken 2026-07-20 against branch `refactor/advisor-maintainability` before any
Phase 4 work.

| | |
|---|---|
| **Scope** | 32 pages · 135 `.tsx` files · 20,373 lines |
| **Baseline commit** | `00cbbd6` |
| **Last updated** | 2026-07-21 (after Step 4.1.2) |

---

## Phase Progress

```
Phase 4.1  UI Architecture      ██████████░░░░░░░░░░  2 of 4 steps
Phase 4.2  UX Engineering       ░░░░░░░░░░░░░░░░░░░░  0 of 4 steps
Phase 4.3  Visual Engineering   ░░░░░░░░░░░░░░░░░░░░  0 of 5 steps
──────────────────────────────────────────────────────────────────
PHASE 4 OVERALL                 ███░░░░░░░░░░░░░░░░░  2 of 13 steps
```

| Step | Title | Status | Commit |
|---|---|---|---|
| **4.1.1** | Trust integrity — remove unverified claims | ✅ **Done** | `fix(frontend): stop presenting unverified claims as fact` |
| **4.1.2** | Design tokens (color/spacing/radius/elevation) | ✅ **Done** | `feat(frontend): establish design-token layer` |
| 4.1.3 | Theme migration — 211 JS ternaries → `dark:` | ⬜ Not started | — |
| 4.1.4 | Component primitives (Button/Input/Card/Skeleton/EmptyState/…) | ⬜ Not started | — |
| 4.2.1 | Accessibility pass — labels, landmarks, focus, ARIA, reduced-motion | ⬜ Not started | — |
| 4.2.2 | State coverage — error/not-found/loading, skeletons, empty states | ⬜ Not started | — |
| 4.2.3 | AI experience — typing/thinking, suggested questions ⚠️ *needs sign-off* | ⬜ Not started | — |
| 4.2.4 | Journey polish — nav, search, filters, confirmations | ⬜ Not started | — |
| 4.3.1 | Landing page | ⬜ Not started | — |
| 4.3.2 | Product / category pages | ⬜ Not started | — |
| 4.3.3 | Illustrations & `next/image` migration | ⬜ Not started | — |
| 4.3.4 | Responsive + performance (code splitting, server components) | ⬜ Not started | — |
| 4.3.5 | Documentation — UI_GUIDELINES, design system | ⬜ Not started | — |

---

## Scorecard

| Dimension | Baseline | Current | Target |
|---|---:|---:|---:|
| Accessibility | 32 | **32** | 90 |
| Consumer Trust | 40 | **82** ▲42 | 90 |
| Design System | 45 | **56** ▲11 | 90 |
| Performance | 55 | **56** ▲1 | 85 |
| UX | 58 | **58** | 88 |
| UI Quality | 65 | **65** | 90 |
| Frontend Architecture | 68 | **71** ▲3 | 90 |
| **Enterprise Readiness (FE)** | 52 | **60** ▲8 | 90 |
| **Production Readiness (FE)** | 55 | **62** ▲7 | 92 |

> Design System / Architecture gains are from the **token layer being
> established and wired** (`darkMode: class`), not yet from adoption — the 878
> `slate-*`, 355 `text-[Npx]`, and 211 theme ternaries still stand and retire in
> Steps 4.1.3–4.1.4.

---

## Baseline Findings

Evidence gathered by static scan of `frontend/src`. Counts are from the
baseline commit.

### Accessibility — 32/100 🔴
| Finding | Count |
|---|---|
| `aria-*` attributes in the entire app | **1** |
| `role=` attributes | **1** |
| `<label htmlFor>` vs `<input>` elements | **2 of 35** |
| `focus-visible:` styles | **0** (88 plain `focus:`) |
| `sr-only` utilities | **0** |
| `<main>` / `<nav>` / `<header>` / `<footer>` across 32 pages | 2 / 2 / 1 / 1 |
| Pages with an `<h1>` | 16 of 32 |
| `prefers-reduced-motion` handling | **0** (387 transitions, 109 animations) |

### UX — 58/100 🟠
| Finding | Count |
|---|---|
| `loading.tsx` / `error.tsx` / `not-found.tsx` / `global-error.tsx` | **0** |
| Skeleton components | **0** (26 raw `animate-spin`, 21 `Spinner`) |
| Empty-state guards | **2** |

### Design System — 45/100 🟠
| Finding | Count |
|---|---|
| Arbitrary pixel values `[Npx]` | **500** |
| `slate-*` vs custom `navy-*` usage | 882 vs 134 |
| Hardcoded hex literals | 22 |
| Shared primitives | 5 |

### Architecture & Performance
| Finding | Count |
|---|---|
| `theme === "dark"` JS ternaries vs Tailwind `dark:` | **211 vs 5** |
| `"use client"` files | **124 of 135** (92%) |
| `next/dynamic` / `React.lazy` | **0** |
| `next/image` usage vs raw `<img>` | 0 vs 6 |
| `useMemo` | 0 |

> **Root cause:** the design system exists in `tailwind.config.ts` but the app
> bypasses it — default `slate-*`, arbitrary pixel values, and per-component JS
> theme ternaries instead of tokens. Phase 4.1.2–4.1.3 addresses this directly.

---

## Completed Steps

### Step 4.1.1 — Trust Integrity ✅

**Commit:** `fix(frontend): stop presenting unverified claims as fact` · **Landed:** 2026-07-21

#### Current Issue
The frontend presented **unverified figures and certifications as fact** across
the consumer surface: claim-settlement ratios (`99.2%`, `99.6%`, `98.8%`),
`50,000+ families protected`, `₹500Cr+ claims disbursed`, `ISO 27001 Certified`,
`PCI-DSS Certified`, `IRDAI Licensed`, `AES-256`, and an `Audited Metric` label
on figures that were never audited. Two components carried **10 fabricated
customer testimonials** — one set describing specific claim-settlement outcomes
("handled the paperwork in 20 minutes", "saved us ₹14,000 annually"). A further
**46 invented fallback values** stood in for per-plan regulated data (IDV,
coverage limits, evacuation cover, hospital-network size, exclusions, risk
level, executive approval status) whenever the API omitted a field. Nothing was
marked as a placeholder anywhere in the codebase.

#### Business Impact
Insurance advertising is IRDAI-regulated. Publishing invented settlement ratios,
claiming certifications the platform does not hold, and attributing testimonials
to people who do not exist are misrepresentations — a launch blocker and a legal
exposure, not a copy preference.

#### User Impact
Aegis exists to *educate, guide and protect* customers who are usually
underserved. Inventing the numbers those customers use to make a financial
decision inverts the mission. The fallback values were the sharpest edge: a user
comparing two plans could be shown a fabricated IDV or exclusion list and never
know the insurer had not supplied it.

#### Recommended Solution
Two new modules establish a single source of truth:

- **`src/lib/platformFacts.ts`** — only values derived from something checkable
  in this repository (4 categories × 9 plans = 36 curated plans, 5 specialist
  advisors), plus `NOT_DISCLOSED` for regulated per-plan data the insurer has
  not supplied.
- **`src/lib/placeholders.ts`** — illustrative testimonials, quarantined and
  required to render with a visible marker. Quotes rewritten to describe the
  *advisory* experience the product actually provides; none imply settlement
  performance or savings.
- **`src/components/shared/PlaceholderNotice.tsx`** — the visible marker,
  rendered next to the content rather than in a footnote.

Fabricated market statistics were replaced with **verifiable product facts**
rather than merely labelled, so the marketing surface stays strong and becomes
true. Certification badges were replaced with statements about what the system
actually does (per-account isolation, revocable sessions, audit-logged activity,
no agent spam).

#### Files Modified
| File | Reason |
|---|---|
| `src/lib/platformFacts.ts` | **New** — verified facts + `NOT_DISCLOSED` |
| `src/lib/placeholders.ts` | **New** — quarantined illustrative content |
| `src/lib/platformFacts.test.ts` | **New** — regression guard (10 tests) |
| `src/components/shared/PlaceholderNotice.tsx` | **New** — visible marker |
| `src/components/TrustSecurity.tsx` | Stats → facts; removed ISO/PCI/IRDAI/AES claims and shields.io badges; testimonials marked |
| `src/components/Testimonials.tsx` | Reviews → placeholders module; "Trusted by Thousands" headline corrected |
| `src/components/Hero.tsx` | 4 stat tiles → `PLATFORM_FACTS`; subheadline corrected |
| `src/components/Footer.tsx` | Removed 50,000-families / 99.2% sentence |
| `src/app/layout.tsx` | Metadata: removed superlative + invented figures |
| `src/app/purchase/payment/page.tsx` | Removed SSL/PCI-DSS/IRDAI badges |
| `src/components/FloatingAI.tsx` | Removed AES-256 claim |
| `src/components/LeadForm.tsx` | "99.2% Claim Track Qualified" → "Advisor Matched" |
| `src/app/agents/page.tsx` | Per-advisor customer counts → catalogue size |
| `src/app/policies/page.tsx` | 4 settlement rates → plans-compared |
| `src/components/PolicyCards.tsx` | 4 claim ratios → `NOT_DISCLOSED` |
| `src/components/apply/recommendation.ts` | 4 claim ratios → `NOT_DISCLOSED` |
| `src/app/purchase/policy/page.tsx` | 4 fallbacks incl. approval status |
| `src/app/purchase/review/page.tsx` | 2 fallbacks |
| `src/components/chat/RecommendationCard.tsx` | 18 fallbacks |
| `src/components/policy-details/CompareTab.tsx` | 8 fallbacks |
| `src/components/policy-details/BenefitsTab.tsx` | 9 fallbacks |
| `src/components/consumer-dashboard/PoliciesViewport.tsx` | 1 fallback + settled badge |

#### Deliberately Not Changed
| Item | Why |
|---|---|
| `data.category \|\| "health"` | Branching discriminator, not a displayed claim |
| `plan.premium \|\| "850"` (×2) | Feeds premium arithmetic — protected workflow (CLAUDE.md §2). Replacing it would produce `NaN` |
| `admin/ai-monitoring` telemetry (`99.8%`, `48ms`) | Internal operator dashboard, not a consumer claim. Belongs to a "wire real telemetry" task |
| Footer toll-free number `1800-419-8800` | Cannot verify from the repo whether it is real — **needs your confirmation** |

#### Expected Result
No unverified claim reaches a user. Regulated per-plan data degrades to
"Not disclosed" instead of a plausible invention. Illustrative content is
labelled where it appears. A guard test fails the build if any of it returns.

#### Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `vitest` | ✅ **181/181** (171 → 181, +10 guard tests) |
| `next lint` | ✅ 0 errors (pre-existing warnings unchanged) |
| `next build` | ✅ static prerender clean |
| Claim re-scan | ✅ 0 remaining outside `placeholders.ts` |

#### Risk & Rollback
Low. Copy and fallback literals only — no logic, routing, or state changed. The
guard test caught 3 sites the manual scan missed (`FloatingAI`,
`purchase/payment`, `apply/recommendation`), which is the argument for keeping
it. Rollback: revert that commit.

---

### Step 4.1.2 — Design Tokens ✅

**Commit:** `feat(frontend): establish design-token layer` · **Landed:** 2026-07-21

#### Current Issue
A design system existed in `tailwind.config.ts` but the app bypassed it: **500**
arbitrary `[Npx]` values (355 of them sub-12px font sizes: `text-[9px]` ×126,
`text-[10px]` ×118, `text-[8px]` ×35, `text-[11px]` ×41), **35** `rounded-[32px]`
card radii, **878** raw `slate-*` usages, and **211** per-component
`theme === "dark" ? …` JS ternaries. Critically, `darkMode` was **unset**
(defaulting to `media`), so Tailwind's `dark:` variant was disconnected from the
`.dark` class the `ThemeContext` already toggles on `<html>` — the two theme
mechanisms could not meet.

#### Recommended Solution
Establish the token layer the remaining UI-architecture steps migrate onto.
**Additive only** — no existing utility was redefined, so there is no visual
change; adoption is Steps 4.1.3 (theme ternaries → `dark:` + semantic colors)
and 4.1.4 (primitives).

**Token contract**

| Category | Tokens | Backed by |
|---|---|---|
| Theme wiring | `darkMode: "class"` | `.dark` on `<html>` (ThemeContext) |
| Surfaces | `surface`, `surface-raised`, `surface-sunken`, `surface-overlay` | CSS vars (light/dark) |
| Borders | `line`, `line-strong` | CSS vars |
| Text | `content`, `content-muted`, `content-subtle`, `content-inverted` | CSS vars |
| Brand | `brand`, `brand-strong`, `accent`, `accent-strong` | CSS vars |
| Typography | `text-3xs` (8px), `text-2xs` (10px) | `fontSize` scale |
| Radius | `rounded-4xl` (32px), `rounded-5xl` (36px) | `borderRadius` scale |
| Elevation | `shadow-elevation-1…4` | `boxShadow` scale |

Colors resolve per theme through CSS variables in `globals.css` (`:root` = light,
`.dark` = dark), mapped to the existing navy / royal / cyan / slate palette so the
design language is unchanged. So a call site writes `bg-surface text-content`
once instead of a `theme === "dark"` ternary.

#### Files Modified
| File | Reason |
|---|---|
| `frontend/tailwind.config.ts` | `darkMode: "class"`; semantic color aliases; `fontSize` / `borderRadius` / `boxShadow` (elevation) scales |
| `frontend/src/app/globals.css` | Semantic color CSS variables for light (`:root`) and dark (`.dark`) |

#### Deliberately Not Changed
| Item | Why |
|---|---|
| 878 `slate-*`, 355 `text-[Npx]`, 211 theme ternaries | Adoption is Steps 4.1.3–4.1.4; this step only lays the foundation |
| Existing `boxShadow` `premium*` / `glow*`, `--background` / `--foreground` | Still referenced app-wide; left intact so nothing shifts |
| Opacity modifiers on token colors (`bg-surface/50`) | CSS vars hold hex, not RGB channels — alpha modifiers unsupported by design; use `rgba()` where needed |

#### Verification
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| JIT compile probe | ✅ all 11 sampled token utilities emit CSS |
| `vitest` | ✅ 181/181 |
| `next lint` | ✅ 0 errors (pre-existing warnings unchanged) |
| `next build` | ✅ exit 0, static prerender clean |

#### Risk & Rollback
Very low. Purely additive config + CSS variables; no call site changed, no
existing utility redefined. The one behavioural wire is `darkMode: "class"`,
which is safe because the app already toggles `.dark` and has ~0 `dark:`
utilities today. Rollback: revert that commit.

---

## Open Items Carried Forward

| # | Item | Raised By | Owner |
|---|---|---|---|
| 1 | Confirm whether `1800-419-8800` is a real, answered number | 4.1.1 | **You** |
| 2 | Replace admin telemetry mock values with real metrics | 4.1.1 | 4.2.x |
| 3 | `plan.premium \|\| "850"` fallback silently invents a premium in maths | 4.1.1 | Needs backend sign-off |
| 4 | Regenerate the DOCX progress report — module table advisor mapping was corrected (Emma = Home/Property, Ethan = Travel) | 4.1.1 | Done in `PROGRESS_REPORT.md`; DOCX pending |
