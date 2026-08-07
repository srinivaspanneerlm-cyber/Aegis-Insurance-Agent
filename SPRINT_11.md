# Sprint 11 — Enterprise Knowledge & Memory Platform

Status: **COMPLETE**, verified 2026-08-07.

---

## 1. Technical Summary

Sprint 11 added two things the platform did not have: a knowledge base somebody
has actually approved, and a memory of a customer the business can defend.

**Phase A** built the backend — governance, versioning, lexical search, an
inverted index, institutional memory and a knowledge router.
**Phase B** built the workspace people use it through.
**Phase C** integrated and verified the two, and fixed three defects found in
the process.

The sprint's organising idea is that a knowledge platform in insurance is only
as good as its provenance. Guidance nobody approved, advice traced to nothing,
and a fact about a customer with no recorded source are all the same failure —
something the platform cannot defend when challenged. Every decision below
follows from that.

---

## 2. Architecture Validation

### What was extended rather than duplicated

| Existing thing | Decision |
|---|---|
| `KnowledgeArticle` | **Extended.** Status, classification, effective window, source, approval and review fields added. The pre-Sprint-11 employee search still reads it unchanged. |
| `WorkItem` | Untouched by Sprint 11. |
| `AuditLog` / `auditService` | **Reused** as the knowledge audit trail. No `KnowledgeAudit` table was created — a parallel table would have split the audit stream in two. |
| `ai-python/app/memory`, `Aegis-AI/layer3` | **Untouched.** These hold each agent's namespaced working memory, and that isolation is the architecture's crown jewel. |

### The memory boundary

```
ai-python/app/memory  +  Aegis-AI/layer3      ← agents' working memory (PROTECTED)
        │                                        namespaced per {domain}_{customer_id}
        │  promote()  ← explicit, never automatic
        ▼
ConversationMemory ──────▶ MemoryRecord        ← institutional memory (Sprint 11)
 session-scoped, pinnable   supersede-never-overwrite, provenance, expiry, audit
```

`OrganizationMemory` is `MemoryRecord` at `ORGANIZATION` scope with its own
service, not its own table. A parallel table would have duplicated supersession,
expiry, provenance and audit — and the copy is always the one that drifts.

### The knowledge lifecycle

```
DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED ──archive──▶ ARCHIVED
  ▲                    │                     │                     │
  └──reject/changes────┘         edit────────┘          (row kept, de-indexed)
```

Creating always produces a draft. Editing an approved article returns it to
draft **and removes it from the search index**, so an unreviewed edit cannot
keep answering questions under a title that has changed.

---

## 3. API Summary

All under `/api/v1/knowledge`. Every route requires a session.

| Method | Path | Permission |
|---|---|---|
| GET | `/categories`, `/tags` | any authenticated |
| POST | `/categories/seed` | `knowledge.write` |
| GET | `/search` | any (results filtered by classification) |
| POST | `/route` | any |
| GET | `/articles`, `/articles/:idOrSlug`, `/articles/:id/history` | any (filtered) |
| POST | `/articles` | `knowledge.write` |
| PATCH | `/articles/:id` | `knowledge.write` |
| POST | `/articles/:id/submit` | `knowledge.write` |
| POST | `/articles/:id/review` | `knowledge.write` **+ review authority** |
| POST | `/articles/:id/archive` | `knowledge.write` + review authority |
| GET/POST | `/articles/:id/permissions` | `knowledge.write` (+ approve to grant) |
| DELETE | `/permissions/:id` | `knowledge.write` + review authority |
| POST | `/parse` | `knowledge.write` |
| GET | `/analytics` | `knowledge.write` |
| POST/GET/DELETE | `/memory/...` | scope-dependent — see §4 |
| POST/GET | `/conversation-memory/...` | owner or `customer.read` |
| GET/POST | `/organization-memory/:id` | `analytics.read` / `organization.manage` |

Every response uses the platform envelope: `{ status, data, results? }` on
success, `{ status: "fail", code, message }` on error.

---

## 4. Security Summary

### Verified live role matrix

| Endpoint | Customer | Employee | Operations | Ent. Admin | Platform |
|---|---|---|---|---|---|
| `GET /categories`, `/tags`, `/articles`, `/search` | 200 | 200 | 200 | 200 | 200 |
| `POST /articles` | 403 | 403 | 201 | 201 | 201 |
| `GET /analytics` | 403 | 403 | 200 | 200 | 200 |
| `POST /categories/seed` | 403 | 403 | 200 | 200 | 200 |

A 200 on `/articles` and `/search` is not access to everything — content is
filtered by classification inside `visibilityFilter`, the single expression of
what a caller may see.

### Verified content isolation

Four articles were published and searched for as each role:

| Article | Customer | Employee | Operations | Ent. Admin | Platform |
|---|---|---|---|---|---|
| PUBLIC, approved | visible | visible | visible | visible | visible |
| INTERNAL, approved | **hidden** | visible | visible | visible | visible |
| RESTRICTED, approved | **404** | **404** | **404** | **404** | 200 (audited) |
| PUBLIC, unapproved draft | **404** | **404** | 200 | 200 | 200 |

`RESTRICTED` returns 404 rather than 403 — a 403 confirms the document exists,
which on a compliance document is itself the disclosure the classification
prevents. A grant makes it both readable *and* findable in search; revoking it
closes both. Both were verified end to end.

### Memory isolation

- A customer reads their own memory and **cannot write it** — correcting the
  platform's record of its own inference is editing evidence, and goes through
  an advisor.
- Another customer's memory: **403**.
- `PLATFORM` scope as an enterprise admin: **403**.

### Audit

Verified present after the integration run:
`knowledge.created`, `knowledge.submitted`, `knowledge.approved`,
`knowledge.archived`, `knowledge.restricted.read`,
`knowledge.permission.granted`, `knowledge.permission.revoked`,
`authz.knowledge.denied`, `memory.remembered`, `memory.recalled`,
`memory.promoted`, `memory.forgotten`, `authz.memory.denied`.

Reads of another person's memory are audited; self-reads are not — auditing
those would drown the log and protect nobody.

---

## 5. Performance Summary

Measured against a seeded corpus of **303 articles / 14,644 index entries**,
12 runs per endpoint, on SQLite.

| Endpoint | Median | p90 |
|---|---|---|
| `GET /categories` | 7.3 ms | 7.7 ms |
| `GET /tags` | 7.4 ms | 9.1 ms |
| `GET /articles?take=100` | 29.6 ms | 33.1 ms |
| `GET /search` (1 term) | 45.6 ms | 76.6 ms |
| `GET /search` (3 terms) | 64.0 ms | 79.1 ms |
| `GET /search` (no match) | 26.7 ms | 30.2 ms |
| `GET /analytics` | 146.8 ms | 163.0 ms |
| `GET /memory/:scope/:id` | 8.2 ms | 18.7 ms |

Search was **158 ms before the Phase C fix and 45.6 ms after** — see §7.

**Bundle sizes** (employee portal, First Load JS shared 102 kB):

| Route | Route JS | First load |
|---|---|---|
| `/knowledge/workspace` | 1.6 kB | 122 kB |
| `/knowledge/a/[slug]` | 1.18 kB | 122 kB |
| `/knowledge/console` | 2.52 kB | 123 kB |
| `/knowledge/new` | 2.3 kB | 123 kB |
| `/memory` | 2.03 kB | 123 kB |

**Caching.** `KnowledgeClient` holds a 30-second read cache for categories,
tags and article lists; any write clears it wholesale, because a stale list
after an approval is worse than the request it saved.

---

## 6. Testing Summary

| Suite | Result |
|---|---|
| `backend/tests/knowledge-memory.test.js` (targeted) | **62 / 62** |
| `packages/knowledge` component tests (targeted) | **40 / 40** |
| Adjacent suites re-run (`employee-operations`, `enterprise-admin`) | 26 / 26, 23 / 23 |
| **Full project suite — one execution** | **535 / 535, 0 fail** (90 s, 114 suites) |
| TypeScript — backend + 19 workspace packages | clean |
| ESLint — whole workspace | 0 problems |
| Builds — 5 Next.js apps | all compile |

---

## 7. Defects Found and Fixed in Phase C

Three, all verified before fixing, all with a regression test.

**1. A 400 carrying a success envelope.**
`POST /articles/:id/review` with an unrecognised decision returned
`{ status: "success" }` with HTTP 400. Every other error on the platform arrives
as `{ status: "fail", code, message }`, so a client checking the envelope rather
than the status code would have read a rejected decision as a success. Now
throws `AppError(400, "UNKNOWN_DECISION")`.

**2. Inverted search ranking.**
`totalIndexed()` took the first 10,000 index-entry rows and counted distinct
articles among them. Past ~200 articles this undercounts, making `N - df`
negative, making IDF negative — which ranks an article matching *more* of the
query *below* one matching less. Observed live as scores of `-1.89` on the top
hit. Replaced with a `groupBy` that scales with articles rather than entries:
**correct ordering, and search 3.5× faster** (158 ms → 45.6 ms).

**3. Arbitrary order on all-common-word queries.**
With IDF floored at zero, a query whose every term is very common scored every
hit identically, leaving the order to whatever the map yielded — ten arbitrary
articles presented as the ten best. Floored at a small positive value instead,
so field weight and query coverage still discriminate.

---

## 8. Known Limitations

Each is stated in the product, not only here.

- **Search is lexical, not semantic.** Said in the search box and in every empty
  result. `EmbeddingService` and `VectorStoreInterface` are declared and
  deliberately unimplemented — a stub returning random vectors ranks by noise.
- **PDF and DOCX are refused, not half-parsed.** A partial extraction that looks
  complete gets approved without being read.
- **Bookmarks live in `localStorage`.** No Phase A endpoint exists; the button
  says "this device only" rather than implying a sync.
- **Tag, visibility and date filters are client-side** — the list endpoint does
  not accept them. The filter panel says which filters narrow only what is
  loaded.
- **`searchEffectiveness` is `{ available: false }`.** Nothing logs queries or
  outcomes; a success rate would be invented.
- **`RESTRICTED` is audit-enforced against administrators, not barrier-enforced.**
  Anyone with review authority can grant themselves access. The control is that
  every grant and every restricted read is audited.

---

## 9. Technical Debt

| Item | Why it matters |
|---|---|
| Two knowledge routes — legacy `/knowledge` and new `/knowledge/workspace` | The old page was Sprint 5/6 work and was deliberately not modified. Two sidebar entries is poor product. |
| `customer-portal` declares `@aegis/knowledge` but uses it in 0 files | Wired ahead of pages that do not exist yet. |
| `searchIndexRepository.lookup` caps at 5,000 rows | A very common term across ~10k articles would truncate its posting list. Bounded on purpose; needs revisiting at that scale. |
| Analytics at 147 ms | Eight queries in parallel. Fine now; needs a rollup at scale. |
| 🔶 `EMPLOYEE` lacks `customer.write` | An advisor cannot record a customer preference — only an enterprise admin can. Sprint 3 decision, not changed here. |
| 🔶 `COMPLIANCE` role has **no** knowledge permissions | The compliance role cannot read compliance guidance. Almost certainly wrong; Sprint 3 decision, not changed here. |

---

## 10. Recommendations for Sprint 12

1. **Consolidate the two knowledge routes** and retire the legacy page.
2. **Fix the two role-model gaps** above — `COMPLIANCE` without `knowledge.read`
   is the more serious of the two.
3. **Server-side tag and date filtering**, so a filter narrows the library
   rather than the page.
4. **A bookmark endpoint**, so a reading list follows a person.
5. **Wire `KnowledgePreview` into the assistant**, so cited guidance carries its
   source and effective window at the point of the answer.
6. **Decide on query logging** — it is the only thing standing between the
   current analytics and a real measure of whether search helps anyone.

---

## 11. Production Readiness Checklist

| Criterion | Status |
|---|---|
| Backend verification | ✅ 62/62 targeted, live integration across 5 roles |
| Frontend verification | ✅ 40/40 component tests, 5 routes build |
| Integration | ✅ every Phase B call exercised against a live Phase A |
| TypeScript | ✅ backend + 19 packages clean |
| ESLint | ✅ 0 problems |
| Build | ✅ 5 apps compile |
| Security validation | ✅ role matrix, classification isolation, memory isolation, audit |
| Targeted tests | ✅ 102 across two suites |
| Full suite, one execution | ✅ 535/535 |
| Documentation | ✅ this file |
| Migrations reversible | ✅ additive only — new tables and nullable columns |
| Secrets | ✅ none staged; `.env` and `dev.db` gitignored |
