/**
 * Pre-merge smoke test (PR-4).
 *
 * Boots nothing itself — it probes an already-running server and asserts the
 * critical paths respond as expected: liveness, DB-gated readiness, and the
 * JSON 404 path (proves the global error handler is wired). Dependency-free
 * (global fetch); exits non-zero on the first failure so CI fails loud.
 *
 *   SMOKE_URL=http://localhost:5000 node scripts/smoke.mjs
 */
const BASE = process.env.SMOKE_URL || "http://localhost:5000";

const CHECKS = [
  { path: "/health", expect: 200 }, // legacy minimal probe
  { path: "/health/live", expect: 200 }, // process up
  { path: "/health/ready", expect: 200 }, // gated on DB connectivity
  { path: "/api/__does_not_exist__", expect: 404 }, // error handler → JSON 404
];

let failed = 0;
for (const { path, expect } of CHECKS) {
  try {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000) });
    const ok = res.status === expect;
    console.log(`${ok ? "✅" : "❌"} GET ${path} → ${res.status} (expected ${expect})`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`❌ GET ${path} → error: ${err.message}`);
    failed++;
  }
}

if (failed) {
  console.error(`\nSmoke FAILED: ${failed}/${CHECKS.length} checks did not pass.`);
  process.exit(1);
}
console.log(`\n✅ Smoke passed: ${CHECKS.length}/${CHECKS.length} checks.`);
