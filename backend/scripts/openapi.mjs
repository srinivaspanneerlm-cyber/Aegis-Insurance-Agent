/**
 * The OpenAPI description of this API, built from the API itself.
 *
 * The route inventory is walked out of the live Express router stack rather
 * than transcribed, because a specification maintained by hand is a
 * specification that is wrong. It does not fail loudly when it drifts — it
 * quietly describes an API that no longer exists, and the people it misleads
 * are the ones who trusted it enough not to read the code.
 *
 * So the shape comes from what actually runs, and only the prose — what each
 * route is for, who may call it — is authored. `openapi.meta.mjs` holds that
 * prose. A route with no entry there still appears in the specification, marked
 * `x-documented: false`: an undescribed endpoint is a gap worth seeing, and
 * inventing a summary for it would be worse than admitting there isn't one.
 *
 * This mirrors how the rest of the codebase keeps its descriptions honest —
 * `workflowCatalogue()` reads the definitions the engine executes, and the
 * console contract test asserts payloads against what the portal declares.
 *
 *   node --import tsx scripts/openapi.mjs          # write backend/openapi.json
 *   node --import tsx scripts/openapi.mjs --check  # fail if it would change
 *
 * Deliberately produces a file and serves nothing. A complete route inventory
 * is a map of the attack surface; the AI engine's Swagger UI is dev-only for
 * the same reason, and this API has no equivalent gate to hide behind.
 */
process.env.NODE_ENV ||= "test";
process.env.JWT_SECRET ||= "openapi-generation-only-not-a-real-signing-key-000";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, TAGS } from "./openapi.meta.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(here, "..", "openapi.json");

/**
 * The mount prefix a router layer was attached at.
 *
 * Express keeps it only as the regular expression it matches with, so the
 * prefix has to be read back out of that. The shape is stable —
 * `^\/api\/v1\/?(?=\/|$)` — and anything that does not match it is returned as
 * null rather than guessed at, so an unrecognised mount is skipped visibly
 * instead of being silently attributed to the wrong path.
 */
function mountPrefix(layer) {
  const source = layer.regexp?.source;
  if (!source) return null;
  if (source === "^\\/?(?=\\/|$)") return "";
  const match = /^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
  if (!match) return null;
  return `/${match[1].replace(/\\\//g, "/")}`;
}

/** Express `:id` is OpenAPI `{id}`. */
const toOpenApiPath = (expressPath) =>
  expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/$/, "") || "/";

const METHODS = ["get", "post", "put", "patch", "delete"];

/** Every route the application actually serves, as `{ method, path }`. */
function walk(stack, prefix, found) {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = `${prefix}${layer.route.path}`;
      for (const method of METHODS) {
        if (layer.route.methods[method]) found.push({ method, path: routePath });
      }
      continue;
    }
    const nested = layer.handle?.stack;
    if (!nested) continue;
    const mounted = mountPrefix(layer);
    if (mounted === null) continue;
    walk(nested, `${prefix}${mounted}`, found);
  }
}

const app = (await import("../src/app.ts")).default;
const router = app._router ?? app.router;

const routes = [];
walk(router.stack, "", routes);

/**
 * The canonical surface only.
 *
 * `/api/*` is mounted as a backward-compatible alias of the same router, so
 * every route appears twice. Describing both would double the specification to
 * say one thing, and would suggest the alias is a parallel API rather than the
 * legacy spelling of this one. The alias is stated in the description instead.
 *
 * `*` is the catch-all 404 handler, which is behaviour rather than an endpoint.
 */
const canonical = routes
  .filter((r) => r.path.startsWith("/api/v1/") || r.path.startsWith("/health"))
  .filter((r) => !r.path.includes("*"));

const seen = new Set();
const unique = canonical.filter((r) => {
  const key = `${r.method} ${r.path}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const paths = {};
let documented = 0;

for (const { method, path: routePath } of unique) {
  const openApiPath = toOpenApiPath(routePath);
  const meta = ROUTE_META[`${method.toUpperCase()} ${openApiPath}`];
  if (meta) documented += 1;

  const parameters = [...openApiPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));

  for (const query of meta?.query ?? []) {
    parameters.push({
      name: query.name,
      in: "query",
      required: false,
      description: query.description,
      schema: { type: query.type ?? "string" },
    });
  }

  paths[openApiPath] ??= {};
  paths[openApiPath][method] = {
    tags: [meta?.tag ?? "Undocumented"],
    ...(meta?.summary ? { summary: meta.summary } : {}),
    ...(meta?.description ? { description: meta.description } : {}),
    ...(parameters.length ? { parameters } : {}),
    // Authority is stated per route because it is the thing a caller most needs
    // and most often assumes. Absent means the route is public.
    ...(meta?.permission ? { "x-permission": meta.permission } : {}),
    ...(meta?.realm ? { "x-realm": meta.realm } : {}),
    ...(meta?.auth === false
      ? { security: [] }
      : { security: [{ cookieAuth: [] }, { bearerAuth: [] }] }),
    // Not a stylistic marker: an endpoint nobody has described is a gap, and
    // the specification should show it rather than read as complete.
    ...(meta ? {} : { "x-documented": false }),
    responses: {
      200: { description: "Success envelope.", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessEnvelope" } } } },
      400: { description: "Validation failed; the offending parameter is named." },
      401: { description: "No valid session." },
      403: { description: "Authenticated, but not permitted." },
    },
  };
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Aegis AI — Backend REST API",
    version: "1.0.0",
    description: [
      "Generated from the running Express router by `scripts/openapi.mjs`; the",
      "route inventory is never hand-maintained. Prose lives in",
      "`scripts/openapi.meta.mjs`.",
      "",
      "Routes marked `x-documented: false` are served but not yet described.",
      "",
      "Every route below is also reachable under `/api/*` without the version",
      "segment. That alias is the legacy spelling of this same router, kept for",
      "backward compatibility — not a second API.",
      "",
      "This document is generated to a file and served nowhere. A complete route",
      "inventory maps the attack surface.",
    ].join("\n"),
  },
  servers: [{ url: "http://localhost:5000", description: "Local development" }],
  tags: TAGS,
  components: {
    securitySchemes: {
      // The browser path. httpOnly, so script cannot read it.
      cookieAuth: { type: "apiKey", in: "cookie", name: "jwt" },
      // The API-client path. Same token, presented differently.
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      SuccessEnvelope: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["success"] },
          data: { description: "The payload; shape varies by endpoint." },
          results: { type: "integer", description: "Row count, on list responses only." },
        },
        required: ["status"],
      },
      ErrorEnvelope: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["fail", "error"] },
          message: { type: "string" },
          code: { type: "string" },
        },
        required: ["status", "message"],
      },
    },
  },
  paths,
};

/**
 * Prose describing a route that does not exist.
 *
 * The inventory being generated protects against an undocumented endpoint; it
 * says nothing about the opposite drift, where a route is renamed or removed
 * and its description lingers. That entry then documents an endpoint callers
 * cannot reach, which is the more embarrassing half of the same failure.
 */
const live = new Set(unique.map((r) => `${r.method.toUpperCase()} ${toOpenApiPath(r.path)}`));
const orphans = Object.keys(ROUTE_META).filter((key) => !live.has(key));

const rendered = `${JSON.stringify(spec, null, 2)}\n`;

if (orphans.length) {
  console.error(
    `${orphans.length} description(s) name a route this API does not serve:\n  ${orphans.join("\n  ")}`
  );
  process.exit(1);
}

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (current !== rendered) {
    console.error("openapi.json is out of date — run: node --import tsx scripts/openapi.mjs");
    process.exit(1);
  }
  console.log(`✅ openapi.json matches the router (${unique.length} routes).`);
} else {
  fs.writeFileSync(OUTPUT, rendered);
  console.log(
    `✅ openapi.json written — ${unique.length} routes, ${documented} described, ${unique.length - documented} still undocumented.`
  );
}

export { unique as routes };
