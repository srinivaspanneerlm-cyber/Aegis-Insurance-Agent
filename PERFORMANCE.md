# PERFORMANCE.md — Performance Engineering (Phase 9)

> Consolidated record of Aegis AI's performance work. Phase 9 followed one
> principle, inherited from the AI-engine phase: **measure first, optimise
> second, and never rewrite a protected path** (orchestration, transfers,
> recommendation/scoring, voice/SSE streaming, memory persistence — see
> [CLAUDE.md](CLAUDE.md) §2/§6). Everything below is additive and
> behaviour-preserving.
>
> **Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_AGENTS.md](AI_AGENTS.md) ·
> [DEPLOYMENT.md](DEPLOYMENT.md) · [DEVOPS.md](DEVOPS.md)

Phase 9 is distinct from Stage 5 (Scalability — pagination, indexing, Redis,
BullMQ, load test). Scalability added the infrastructure to handle load; Phase 9
added the **measurement, regression guards, and connection/latency tuning** to
know when and where performance changes.

| Step | Area | Deliverable |
|---|---|---|
| 9.1 | AI engine | Latency baseline + regression guard for pure hot paths |
| 9.2 | Backend | HTTP keep-alive tuning (proxy-502 race) |
| 9.3 | AI engine | Per-environment diagnostics on `/metrics` |
| 9.3b | AI engine | Observation-only timing of Layer-3 memory ops |
| 9.4 | Frontend | Bundle-size budget in CI + Core Web Vitals reporting |

---

## 1. AI hot-path latency baseline (9.1)

Three pure, rule-based paths run on the request thread **before** any LLM call.
`ai-python/tests/perf/` benchmarks them (dependency-free, LLM-free,
side-effect-free — it reuses the eval personas and runs on copied dicts, so it
writes no customer data and touches no protected path).

Baseline (dev box; wall-clock, machine-dependent):

| Hot path | median | p95 |
|---|---|---|
| scoring · health | 0.12 ms | 0.15 ms |
| scoring · motor | 0.16 ms | 0.19 ms |
| scoring · travel | 0.18 ms | 0.20 ms |
| scoring · property | 0.20 ms | 0.23 ms |
| prompt render · full profile | 0.03 ms | 0.03 ms |
| bm25 retrieval · health | 0.41 ms | 0.51 ms |

Every pre-LLM path is sub-millisecond — the LLM call dominates a turn, as
expected. The tests assert a **generous absolute median ceiling** (scoring
< 50 ms, render < 10 ms, retrieval < 100 ms — an order of magnitude over steady
state) so they catch a structural regression (a lost cache, an accidental
O(n²), a per-call index rebuild) without flaking on a slow CI runner. Because
timings are machine-dependent, nothing here is pinned to a golden value.

```bash
cd ai-python
./venv/bin/pytest tests/perf                 # regression guard
./venv/bin/pytest tests/perf -s              # print the baseline table
```

---

## 2. Backend HTTP keep-alive tuning (9.2)

Node's default `keepAliveTimeout` is 5 s. Behind a proxy / load balancer that
holds idle upstream connections longer (nginx / AWS ALB, commonly 60 s), Node can
close a socket at the exact moment the proxy reuses it — surfacing as
**intermittent 502s** and lost connection reuse under load.

`backend/src/config/serverTimeouts.ts` resolves and validates two env knobs,
applied to the HTTP server in `server.ts`:

| Env | Default | Rule |
|---|---|---|
| `KEEPALIVE_TIMEOUT_MS` | `61000` | Keep **above** the upstream proxy's idle timeout |
| `HEADERS_TIMEOUT_MS` | `65000` | Keep **above** `KEEPALIVE_TIMEOUT_MS` so the header-read timer never fires mid-connection |

The invariant `headers > keepAlive > 0` is enforced at boot — **fail-fast in
production, warn in development** — so a misordered pair can't silently cut
requests short.

Response **compression** (gzip/deflate) was already in place (`app.ts`, enabled
by default via `FEATURE_COMPRESSION`).

---

## 3. Observability — the `/metrics` catalogue

The AI engine exposes Prometheus metrics at `/metrics` (deliberately not under
`/api`; reached over the internal network). All recording is **defensive** — a
metrics failure never breaks a reply or a write — and label cardinality is
bounded by a fixed vocabulary.

| Metric | Type | Labels | Phase |
|---|---|---|---|
| `aegis_ai_dispatch_seconds` | histogram | `domain`, `outcome` | 8.2 |
| `aegis_ai_llm_call_seconds` | histogram | `provider`, `outcome` | 8.2 |
| `aegis_ai_llm_tokens_total` | counter | `provider`, `kind` | 8.2 |
| `aegis_ai_env_requests_total` | counter | `domain` | 9.3 |
| `aegis_ai_env_errors_total` | counter | `domain` | 9.3 |
| `aegis_ai_env_cache_hits_total` | counter | `domain` | 9.3 |
| `aegis_ai_env_cache_misses_total` | counter | `domain` | 9.3 |
| `aegis_ai_env_response_time_ms_total` | counter | `domain` | 9.3 |
| `aegis_ai_memory_op_seconds` | histogram | `operation`, `outcome` | 9.3b |

### 3a. Per-environment diagnostics (9.3)

A **pull-based** collector reads the live `EnvironmentDiagnostics` from every
agent environment at scrape time only — zero cost on the request path. It
discovers the REST and stream orchestrators via `sys.modules` (never imports
them, so a scrape can't boot an orchestrator), dedupes by identity, and sums per
domain. Raw counters are exported (not pre-computed ratios) so the useful rates
derive in PromQL and aggregate correctly across replicas:

```promql
# cache hit-rate per domain
sum by (domain) (rate(aegis_ai_env_cache_hits_total[5m]))
  / ( sum by (domain) (rate(aegis_ai_env_cache_hits_total[5m]))
    + sum by (domain) (rate(aegis_ai_env_cache_misses_total[5m])) )

# error-rate per domain
rate(aegis_ai_env_errors_total[5m]) / rate(aegis_ai_env_requests_total[5m])

# mean in-environment response time (ms) per domain
rate(aegis_ai_env_response_time_ms_total[5m]) / rate(aegis_ai_env_requests_total[5m])
```

### 3b. Memory-op timing (9.3b)

The Layer-3 persistence path is protected, so it is instrumented
**observation-only** via a `@timed_memory_op(operation)` decorator: the op's
return value and any exception propagate unchanged, timing is recorded in a
`finally`, and the recorder swallows its own errors. Eight disk-hitting ops are
timed — `conversation_load`, `conversation_save_turn`, `profile_load_shared`,
`profile_save_shared`, `profile_load_domain`, `profile_save_domain`,
`rec_cache_store`, `rec_cache_retrieve`.

```promql
# p95 memory-op latency per operation
histogram_quantile(0.95, sum by (le, operation) (rate(aegis_ai_memory_op_seconds_bucket[5m])))

# p95 dispatch latency per domain
histogram_quantile(0.95, sum by (le, domain) (rate(aegis_ai_dispatch_seconds_bucket[5m])))
```

---

## 4. Frontend bundle budget + Web Vitals (9.4)

**Bundle budget.** Next has no built-in budget gate. `frontend/scripts/bundle-budget.mjs`
(dependency-free) measures the emitted client JS after `next build` and fails
when it crosses a generous ceiling. The frontend CI job now also **builds** (it
previously only type-checked/linted/tested) and runs the budget check.

| Metric | Current | Budget (override env) |
|---|---|---|
| Total client JS (`.next/static/chunks`, raw) | ~1800 KB | `BUNDLE_TOTAL_MAX_KB` = 3072 |
| Largest single chunk | ~169 KB | `BUNDLE_CHUNK_MAX_KB` = 256 |

```bash
cd frontend
npm run build && npm run bundle:budget
```

**Core Web Vitals.** `src/components/WebVitalsReporter.tsx` (mounted once at the
root) uses `next/web-vitals` — no new dependency — to log LCP/INP/CLS/etc.
through the shared logger and, when `NEXT_PUBLIC_WEBVITALS_URL` is set, beacon
them via `navigator.sendBeacon` (fire-and-forget). It is log-only by default, so
it adds no network cost unless a sink is configured.

---

## 5. What is deliberately *not* instrumented

- **The SSE / voice streaming path** (`stream_service`, `stream_routes`,
  `useVoice`) — protected; adding request-path timing there needs explicit
  sign-off. The non-streaming REST path carries the equivalent metrics.
- **`WEB_CONCURRENCY` stays pinned at 1** in the AI Dockerfile until the Layer-3
  `memory_engine` storage (in the `Aegis-AI/` tree) is made multi-worker-safe —
  a separate, protected-KB task, unrelated to the timing added here.
- **Field Web-Vitals data** only flows once real users load the app (or a
  `NEXT_PUBLIC_WEBVITALS_URL` sink is configured).

---

## 6. Run everything

```bash
# AI engine — latency guard + baseline table
cd ai-python && ./venv/bin/pytest tests/perf -s

# Backend — keep-alive resolver tests + load test
cd backend && npm test                       # includes keepalive.test.js
RL_API_MAX=100000000 npm start &             # then, in another shell:
npm run loadtest

# Frontend — bundle budget
cd frontend && npm run build && npm run bundle:budget

# Live metrics
curl -s localhost:8000/metrics | grep aegis_ai_
```
