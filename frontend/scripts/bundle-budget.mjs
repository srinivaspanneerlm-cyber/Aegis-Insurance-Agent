/**
 * Dependency-free client-bundle budget check (Phase 9.4).
 *
 * Next has no built-in budget gate, so a heavy dependency can slip into the
 * client bundle unnoticed. After `next build` this measures the emitted client
 * JS in `.next/static/chunks` and fails the build when it crosses a budget.
 *
 * Like the perf ceilings in the AI engine (9.1), the budgets are generous — a
 * tripwire for a real regression (a charting lib, a moment.js) rather than a
 * tight SLA — so they never flake. Sizes are raw/uncompressed to match the
 * 2026-07 baseline (total ~2.0 MB, largest chunk ~169 KB); override via
 * BUNDLE_TOTAL_MAX_KB / BUNDLE_CHUNK_MAX_KB.
 *
 * The pure `checkBudget` is exported so it can be unit-tested without a build.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const KB = 1024;

export const DEFAULT_BUDGETS = {
  totalMaxKb: Number(process.env.BUNDLE_TOTAL_MAX_KB || 3072), // 3.0 MB
  chunkMaxKb: Number(process.env.BUNDLE_CHUNK_MAX_KB || 256), // 256 KB
};

/**
 * Decide whether a set of chunks fits the budget.
 * @param {{name: string, bytes: number}[]} chunks
 * @param {{totalMaxKb: number, chunkMaxKb: number}} budgets
 */
export function checkBudget(chunks, budgets = DEFAULT_BUDGETS) {
  const totalKb = chunks.reduce((sum, c) => sum + c.bytes, 0) / KB;
  const largest = chunks.reduce(
    (max, c) => (c.bytes > max.bytes ? c : max),
    { name: "(none)", bytes: 0 }
  );
  const largestKb = largest.bytes / KB;

  const violations = [];
  if (totalKb > budgets.totalMaxKb) {
    violations.push(
      `total client JS ${totalKb.toFixed(0)}KB exceeds budget ${budgets.totalMaxKb}KB`
    );
  }
  if (largestKb > budgets.chunkMaxKb) {
    violations.push(
      `largest chunk ${largest.name} ${largestKb.toFixed(0)}KB exceeds budget ${budgets.chunkMaxKb}KB`
    );
  }

  return {
    ok: violations.length === 0,
    totalKb,
    largest: { name: largest.name, kb: largestKb },
    violations,
  };
}

function readChunks(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true });
  } catch {
    return null; // directory missing → caller reports "build first"
  }
  const chunks = [];
  for (const rel of entries) {
    if (typeof rel !== "string" || !rel.endsWith(".js")) continue;
    try {
      const st = statSync(join(dir, rel));
      if (st.isFile()) chunks.push({ name: rel, bytes: st.size });
    } catch {
      /* transient/removed file — skip */
    }
  }
  return chunks;
}

function main() {
  const dir = join(process.cwd(), ".next", "static", "chunks");
  const chunks = readChunks(dir);
  if (!chunks) {
    console.error(`[bundle-budget] ${dir} not found — run \`next build\` first.`);
    process.exit(1);
  }

  const result = checkBudget(chunks);
  console.log("\nClient bundle budget (raw, uncompressed)\n");
  console.log(`  chunks:  ${chunks.length}`);
  console.log(
    `  total:   ${result.totalKb.toFixed(0)} KB   (budget ${DEFAULT_BUDGETS.totalMaxKb} KB)`
  );
  console.log(
    `  largest: ${result.largest.kb.toFixed(0)} KB  ${result.largest.name}   (budget ${DEFAULT_BUDGETS.chunkMaxKb} KB)`
  );

  if (!result.ok) {
    console.error(`\n❌ Bundle budget exceeded:\n  - ${result.violations.join("\n  - ")}\n`);
    process.exit(1);
  }
  console.log("\n✅ Within budget.\n");
}

// Run only when invoked directly (not when imported by the unit test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
