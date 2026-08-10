/**
 * The specification and the router agree.
 *
 * `openapi.json` is generated from the live Express stack, which makes it
 * accurate the moment it is written and says nothing about the moment after.
 * A specification only stays true if something fails when it stops being true,
 * so this runs the generator in check mode and fails on any of three drifts:
 *
 *   • a route the router serves and the specification omits
 *   • a description naming a route the API does not serve
 *   • a committed `openapi.json` that no longer matches either
 *
 * The check runs as a subprocess on purpose. The generator writes a file when
 * run normally, and a test that quietly rewrites a committed artefact to make
 * itself pass is not a test.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const SPEC = path.join(root, "openapi.json");

describe("the OpenAPI description", () => {
  test("matches the routes the application actually serves", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/openapi.mjs", "--check"],
      { cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } }
    );
    assert.equal(
      result.status,
      0,
      `openapi.json is stale or describes a route that does not exist.\n${result.stderr}`
    );
  });

  test("is committed, and is valid JSON", () => {
    assert.ok(fs.existsSync(SPEC), "openapi.json must be committed, not generated on demand");
    const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
    assert.equal(spec.openapi, "3.1.0");
    assert.ok(Object.keys(spec.paths).length > 0, "the specification must describe some paths");
  });

  test("states how a caller authenticates", () => {
    const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
    assert.ok(spec.components.securitySchemes.cookieAuth, "the browser path");
    assert.ok(spec.components.securitySchemes.bearerAuth, "the API-client path");
  });

  test("says which routes are public, rather than leaving it to be assumed", () => {
    const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
    // Signing out must work from a session the server no longer accepts, and
    // the catalogue is readable by somebody comparing cover without an account.
    assert.deepEqual(spec.paths["/api/v1/policies"].get.security, []);
    assert.deepEqual(spec.paths["/health/ready"].get.security, []);
    // Everything on the console is walled.
    assert.ok(spec.paths["/api/v1/enterprise/dashboard"].get.security.length > 0);
  });

  test("carries the authority each console route needs", () => {
    const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
    const dashboard = spec.paths["/api/v1/enterprise/dashboard"].get;
    assert.equal(dashboard["x-realm"], "ENTERPRISE");
    assert.equal(dashboard["x-permission"], "analytics.read");
    // The route that no tenant role can reach — stated rather than implied.
    assert.equal(
      spec.paths["/api/v1/enterprise/ai-systems"].get["x-permission"],
      "platform.configure"
    );
  });

  test("shows undescribed routes as gaps rather than reading as complete", () => {
    const spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));
    const operations = Object.values(spec.paths).flatMap((byMethod) => Object.values(byMethod));
    const undocumented = operations.filter((op) => op["x-documented"] === false);
    // Not asserted as zero: the six remaining routers are the next task, and a
    // test demanding completeness now would only invite a fabricated summary.
    assert.ok(
      undocumented.every((op) => op.tags.includes("Undocumented")),
      "an undescribed route must be tagged as one, so it cannot hide among the described"
    );
  });
});
