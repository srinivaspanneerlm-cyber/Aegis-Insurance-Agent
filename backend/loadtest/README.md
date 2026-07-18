# Load test

A small [autocannon](https://github.com/mcollina/autocannon) harness for the
Aegis backend, targeting the read paths the scale work touched: the cached,
paginated policy catalogue, plus `/health` as a no-DB ceiling.

## Running it

```bash
# 1) Boot the API with the per-IP rate limiter raised — it would otherwise cap a
#    single synthetic client at RL_API_MAX (100 req / 15 min) and you'd measure
#    429s instead of throughput. Everything else is normal.
RL_API_MAX=100000000 PORT=5000 npm start

# 2) In another shell:
npm run loadtest
# or point it elsewhere / tune load:
LOADTEST_URL=http://host:port LOADTEST_DURATION=10 LOADTEST_CONNECTIONS=50 npm run loadtest
```

Toggle the cache to see its contribution: boot once normally and once with
`FEATURE_RESPONSE_CACHE=false`.

## Baseline results

> **Indicative only.** Captured on the dev machine with **SQLite** and the
> **in-process** cache, 50 connections × 8s, `NODE_ENV=production`. Read these
> as *relative* comparisons, not a production SLA. On Postgres-over-network the
> cache delta would be **larger** (a network round-trip is saved on every hit),
> and absolute numbers depend entirely on the host.

| Scenario | Cache ON — req/sec | p50 | p99 | Cache OFF — req/sec | p50 | p99 |
|---|---|---|---|---|---|---|
| `GET /health` (no DB) | 1176 | 38 ms | 72 ms | 1175 | 39 ms | 73 ms |
| `GET /api/policies` | **955** | 50 ms | 93 ms | 645 | 74 ms | 126 ms |
| `GET /api/policies?limit=2` | 984 | 47 ms | 92 ms | 675 | 71 ms | 95 ms |

0 non-2xx and 0 errors in every run.

## What it shows

- **The response cache (5.3) is worth ~+48% throughput and ~−32% p50 latency**
  on the catalogue read path (955 vs 645 req/sec) — and this is against local
  SQLite, so the win grows with a real networked database.
- **`/health` is flat (~1175 req/sec) with the cache on or off**, which confirms
  the difference above is database work, not HTTP/framework overhead — i.e. the
  cache is doing exactly what it should.
- **Pagination adds no measurable overhead** — `?limit=2` tracks the default
  page, so bounding the query (5.1) is free on the hot path while removing the
  unbounded-scan risk as the table grows.

## Notes

- The AI/chat and auth-gated endpoints are not load-tested here: they fan out to
  the paid LLM engine (deliberately rate-limited) and need a signed session, so
  they are not a meaningful raw-throughput target.
- Durability of background jobs and multi-node cache sharing come from the Redis
  backings (5.3 / 5.4); those are correctness properties, exercised by their own
  checks rather than this throughput harness.
