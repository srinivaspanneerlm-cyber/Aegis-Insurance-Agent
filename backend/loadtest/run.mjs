/**
 * Load-test harness for the Aegis backend.
 *
 * Fires autocannon at the read paths that scale work targeted (the cached,
 * paginated policy catalogue) plus /health as a no-DB ceiling, and prints a
 * req/sec + p50/p99 summary.
 *
 * Usage:
 *   1. Boot the server with the per-IP rate limiter raised (it would otherwise
 *      cap a single synthetic client at RL_API_MAX):
 *        RL_API_MAX=100000000 PORT=5000 npm start
 *   2. In another shell:
 *        npm run loadtest                 # defaults to http://localhost:5000
 *        LOADTEST_URL=http://host:port LOADTEST_DURATION=10 npm run loadtest
 *
 * Numbers are indicative of the machine they run on (dev box + SQLite +
 * in-process cache), not a production SLA — read them as relative comparisons.
 */
import autocannon from "autocannon";

const BASE = process.env.LOADTEST_URL || "http://localhost:5000";
const DURATION = Number(process.env.LOADTEST_DURATION || 10);
const CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS || 50);

const scenarios = [
  ["GET /health", "/health"],
  ["GET /api/policies", "/api/policies"],
  ["GET /api/policies?limit=2", "/api/policies?limit=2"],
];

function fire(url) {
  return new Promise((resolve, reject) => {
    autocannon(
      { url, connections: CONNECTIONS, duration: DURATION, pipelining: 1 },
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });
}

console.log(`\nLoad test → ${BASE}  (${CONNECTIONS} connections, ${DURATION}s each)\n`);

const rows = [];
for (const [scenario, path] of scenarios) {
  const r = await fire(BASE + path);
  rows.push({
    scenario,
    "req/sec": Math.round(r.requests.average),
    "p50 ms": r.latency.p50,
    "p99 ms": r.latency.p99,
    non2xx: r.non2xx,
    errors: r.errors,
  });
}

console.table(rows);
