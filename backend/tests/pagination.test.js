/**
 * parsePageParams — the single place list endpoints derive page/limit.
 *
 * It exists to make every list query bounded (CLAUDE.md §9): the limit defaults
 * to the max page size and is hard-capped there, and both values are clamped to
 * a sane minimum, so no `?limit=` can ever provoke an unbounded scan.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test-only-signing-key-not-used-anywhere-real-0123456789";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { parsePageParams } = require("../src/utils/pagination");
const { PAGINATION } = require("../src/config/constants");

describe("parsePageParams", () => {
  test("defaults to page 1 and the max page size (backward-compatible)", () => {
    assert.deepEqual(parsePageParams(), { page: 1, limit: PAGINATION.MAX_LIMIT });
    assert.deepEqual(parsePageParams({}), { page: 1, limit: PAGINATION.MAX_LIMIT });
  });

  test("parses explicit numeric-string page and limit", () => {
    assert.deepEqual(parsePageParams({ page: "3", limit: "25" }), { page: 3, limit: 25 });
  });

  test("caps limit at MAX_LIMIT so a query can never be unbounded", () => {
    assert.equal(parsePageParams({ limit: "100000" }).limit, PAGINATION.MAX_LIMIT);
  });

  test("clamps page and limit up to a minimum of 1", () => {
    assert.deepEqual(parsePageParams({ page: "0", limit: "0" }), { page: 1, limit: 1 });
    assert.deepEqual(parsePageParams({ page: "-5", limit: "-9" }), { page: 1, limit: 1 });
  });

  test("falls back to defaults for non-numeric input", () => {
    assert.deepEqual(parsePageParams({ page: "abc", limit: "xyz" }), {
      page: 1,
      limit: PAGINATION.MAX_LIMIT,
    });
  });

  test("takes the first value when a param is repeated (?limit=10&limit=20)", () => {
    assert.equal(parsePageParams({ limit: ["10", "20"] }).limit, 10);
  });
});
