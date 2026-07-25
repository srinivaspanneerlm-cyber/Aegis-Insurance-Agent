#!/usr/bin/env node
/**
 * Switch the Prisma datasource provider between SQLite (dev) and PostgreSQL
 * (prod) — a real deploy operation, not the silent env-flip the docs once
 * implied.
 *
 * Prisma's datasource `provider` is a *literal* (it cannot be read from
 * `env()`), and `migration_lock.toml` pins it too, so both must be rewritten
 * together before `prisma generate` / `migrate`. Run this in the production
 * image build (or CI) — never commit the result back; dev stays on the
 * committed default (sqlite).
 *
 *   node scripts/set-db-provider.js postgresql
 *   DATABASE_PROVIDER=postgresql node scripts/set-db-provider.js
 *
 * NOTE: this switches the provider only. Migration SQL is dialect-specific, so a
 * Postgres deployment must generate its own migration lineage against a Postgres
 * shadow DB (`prisma migrate dev`) — the models are identical, the SQL is not.
 * See DATABASE.md.
 */
const fs = require("node:fs");
const path = require("node:path");

const VALID = ["sqlite", "postgresql"];

// Rewrite only a datasource-style provider (sqlite|postgresql); the generator's
// `provider = "prisma-client-js"` never matches, so it is left untouched.
function rewriteProvider(text, target) {
  return text.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${target}"`);
}

function main(argv, env) {
  const target = (argv[2] || env.DATABASE_PROVIDER || "sqlite").trim();
  if (!VALID.includes(target)) {
    console.error(
      `[set-db-provider] invalid provider "${target}" — expected one of: ${VALID.join(", ")}`
    );
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
  const lockPath = path.join(__dirname, "..", "prisma", "migrations", "migration_lock.toml");

  fs.writeFileSync(schemaPath, rewriteProvider(fs.readFileSync(schemaPath, "utf8"), target));
  fs.writeFileSync(lockPath, rewriteProvider(fs.readFileSync(lockPath, "utf8"), target));

  console.log(`[set-db-provider] datasource provider + migration lock set to "${target}".`);
}

module.exports = { VALID, rewriteProvider, main };

if (require.main === module) main(process.argv, process.env);
