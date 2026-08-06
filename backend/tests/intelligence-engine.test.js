/**
 * The Insurance Intelligence Engine.
 *
 * These tests are about whether the *advice is right*, not only whether the
 * code runs. An engine that returns a well-formed recommendation for the wrong
 * reason is worse than one that crashes, because nobody notices.
 *
 * So the assertions are mostly about reasoning: that a 26-year-old with no
 * dependants is not pushed toward life cover, that somebody holding two health
 * policies is told to cancel one, that an unknown fact is reported as unknown
 * rather than as low risk, and that nothing leaves the engine unexplained.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-signing-key-not-used-anywhere-real-0123456789";
process.env.RL_AUTH_MAX = "2000";
process.env.RL_API_MAX = "5000";
process.env.CLIENT_URL = "http://localhost:3000,http://localhost:3102";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

const dbFile = path.join(os.tmpdir(), `aegis-intel-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const { RuleBasedNeedAnalysis, lifeStageOf } = require("../src/intelligence/needAnalysis");
const { RuleBasedRiskAnalysis } = require("../src/intelligence/risk");
const { RuleBasedCoverageGap } = require("../src/intelligence/coverageGap");
const { RuleBasedRenewalPrediction } = require("../src/intelligence/renewal");
const { RuleBasedRecommendation, UnavailablePolicyMatching } = require("../src/intelligence/recommendation");
const {
  createIntelligenceEngine,
  registerIntelligenceEngine,
  resetIntelligenceEngine,
  hashProfile,
} = require("../src/intelligence/engine");
const { profileCompleteness, confidenceFrom } = require("../src/intelligence/explain");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

after(async () => {
  resetIntelligenceEngine();
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(prefix, realm = "CUSTOMER", role = "CUSTOMER") {
  const email = `intel-${prefix}-${seq++}-${Date.now()}@example.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: prefix, email, password: PASSWORD, passwordConfirm: PASSWORD });
  const userId = res.body?.data?.user?.id;

  // The realm is changed after registration and the registration cookie is
  // kept, rather than signing in again. Signing in again would be rejected by
  // the portal gateway — a staff account signs in at its own portal origin, not
  // the customer one — and that gateway is Sprint 4's behaviour, not a problem
  // to work around here. `protect` reads the role from the database on every
  // request, so the existing session picks the new role up immediately.
  if (realm !== "CUSTOMER" || role !== "CUSTOMER") {
    await prisma.user.update({
      where: { id: userId },
      data: { realm, role, emailVerifiedAt: new Date() },
    });
  }
  return { userId, email, cookie: cookieHeader(res) };
}

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/intelligence${p}`).set("Cookie", cookie),
  put: (p, body) =>
    request(app).put(`/api/v1/intelligence${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  post: (p, body) =>
    request(app).post(`/api/v1/intelligence${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  del: (p) => request(app).delete(`/api/v1/intelligence${p}`).set("Origin", ORIGIN).set("Cookie", cookie),
});

// ── Need analysis ────────────────────────────────────────────────────────────

describe("need analysis", () => {
  const need = new RuleBasedNeedAnalysis();

  test("life stage weighs dependants, not age alone", () => {
    // The whole point of not using an age table: these two are the same age and
    // are in genuinely different positions.
    assert.equal(lifeStageOf({ userId: "a", age: 30, dependents: 0 }), "YOUNG_INDEPENDENT");
    assert.equal(lifeStageOf({ userId: "b", age: 30, dependents: 2 }), "YOUNG_FAMILY");
    assert.equal(lifeStageOf({ userId: "c", age: 68 }), "RETIRED");
    assert.equal(lifeStageOf({ userId: "d" }), "UNKNOWN");
  });

  test("life cover is sized from income, years and dependants", async () => {
    const report = await need.analyse({
      userId: "u",
      age: 30,
      incomeRange: "6L_12L",
      dependents: 2,
    });

    // 9L midpoint × 30 years to 60 × 0.7 replacement share = ~1.89 crore.
    const estimate = report.financialResponsibility.estimatedLifeCoverNeeded;
    assert.ok(estimate > 15_000_000 && estimate < 22_000_000, `got ${estimate}`);
    assert.equal(report.financialResponsibility.yearsOfSupportNeeded, 30);
  });

  test("somebody with no dependants gets a lower replacement share", async () => {
    const withDeps = await need.analyse({ userId: "a", age: 30, incomeRange: "6L_12L", dependents: 2 });
    const without = await need.analyse({ userId: "b", age: 30, incomeRange: "6L_12L", dependents: 0 });
    assert.ok(
      without.financialResponsibility.estimatedLifeCoverNeeded <
        withDeps.financialResponsibility.estimatedLifeCoverNeeded,
      "no dependants should need less cover"
    );
  });

  test("existing life cover is subtracted from the gap", async () => {
    const report = await need.analyse({
      userId: "u",
      age: 30,
      incomeRange: "6L_12L",
      dependents: 2,
      heldPolicies: [
        { id: "p1", domain: "life", sumInsured: 5_000_000, status: "ACTIVE", external: true },
      ],
    });
    assert.ok(
      report.protectionGapValue < report.financialResponsibility.estimatedLifeCoverNeeded,
      "held cover must reduce the gap"
    );
  });

  test("motor outranks everything when a vehicle is owned, because it is the law", async () => {
    const report = await need.analyse({
      userId: "u",
      age: 40,
      dependents: 3,
      vehicles: [{ kind: "CAR" }],
    });
    assert.equal(report.coveragePriority[0].domain, "motor");
    assert.match(report.coveragePriority[0].rationale, /law/i);
  });

  test("life ranks low when nobody depends on the income", async () => {
    const report = await need.analyse({ userId: "u", age: 26, dependents: 0 });
    const life = report.coveragePriority.find((p) => p.domain === "life");
    const health = report.coveragePriority.find((p) => p.domain === "health");
    assert.ok(life.rank > health.rank, "health must come before life for a single person");
    assert.match(life.rationale, /nobody currently depends/i);
  });

  test("an empty profile still produces a report, with low confidence", async () => {
    const report = await need.analyse({ userId: "u" });
    assert.equal(report.lifeStage, "UNKNOWN");
    assert.equal(report.financialResponsibility.estimatedLifeCoverNeeded, null);
    assert.ok(report.explanation.confidence.score <= 0.3);
    assert.ok(report.explanation.confidence.improvedBy.length > 0);
  });
});

// ── Risk ─────────────────────────────────────────────────────────────────────

describe("risk analysis", () => {
  const risk = new RuleBasedRiskAnalysis();

  test("an unknown fact is UNKNOWN, never LOW", async () => {
    // The most important assertion in this file. Treating a blank as safe is
    // how somebody gets sold a policy that will not pay.
    const summary = await risk.assess({ userId: "u" });
    for (const factor of summary.factors) {
      assert.equal(factor.band, "UNKNOWN", `${factor.dimension} should be unknown on an empty profile`);
      assert.equal(factor.score, null);
    }
    assert.equal(summary.overall, "UNKNOWN");
    assert.equal(summary.overallScore, null);
  });

  test("overall stays UNKNOWN until enough dimensions are assessable", async () => {
    const summary = await risk.assess({ userId: "u", age: 30 });
    const known = summary.factors.filter((f) => f.band !== "UNKNOWN");
    assert.ok(known.length < 3);
    assert.equal(summary.overall, "UNKNOWN", "two known dimensions must not produce an overall band");
  });

  test("an unrecognised occupation is unknown rather than average", async () => {
    const summary = await risk.assess({ userId: "u", occupation: "professional kite designer" });
    const occ = summary.factors.find((f) => f.dimension === "occupation");
    assert.equal(occ.band, "UNKNOWN");
    assert.match(occ.drivers[0], /do not have a risk rating/i);
  });

  test("a hazardous occupation is rated and suggests accident cover", async () => {
    const summary = await risk.assess({ userId: "u", occupation: "construction supervisor" });
    const occ = summary.factors.find((f) => f.dimension === "occupation");
    assert.equal(occ.band, "ELEVATED");
    assert.ok(occ.mitigations.some((m) => /accident/i.test(m)));
  });

  test("a lower income band raises financial risk and says why that means more cover", async () => {
    const summary = await risk.assess({ userId: "u", incomeRange: "BELOW_3L" });
    const fin = summary.factors.find((f) => f.dimension === "financial");
    assert.ok(fin.score >= 40);
    // The wording matters: low income must not read as "not worth insuring".
    assert.match(fin.drivers[0], /more important here, not less/i);
  });

  test("every risk summary carries a full explanation", async () => {
    const summary = await risk.assess({ userId: "u", age: 45, occupation: "software engineer", dependents: 2 });
    const e = summary.explanation;
    assert.ok(e.why && e.how.length > 0 && e.limitations.length > 0);
    assert.ok(e.alternatives.length > 0);
    assert.ok(e.confidence.score > 0 && e.confidence.score <= 0.95);
  });
});

// ── Coverage gaps ────────────────────────────────────────────────────────────

describe("coverage gap detection", () => {
  const need = new RuleBasedNeedAnalysis();
  const gapService = new RuleBasedCoverageGap();

  const analyse = async (profile) => gapService.detect(profile, await need.analyse(profile));

  test("a missing motor policy is CRITICAL because it is a legal requirement", async () => {
    const gaps = await analyse({ userId: "u", age: 35, vehicles: [{ kind: "CAR" }] });
    const motor = gaps.find((g) => g.domain === "motor" && g.kind === "MISSING");
    assert.equal(motor.severity, "CRITICAL");
    assert.match(motor.explanation.risksOfInaction[0], /prosecution|unlimited/i);
  });

  test("two health policies are reported as a duplicate to cancel", async () => {
    // The platform losing revenue is the point of this test.
    const gaps = await analyse({
      userId: "u",
      age: 40,
      incomeRange: "6L_12L",
      heldPolicies: [
        { id: "a", domain: "health", sumInsured: 500_000, premium: 12_000, status: "ACTIVE", external: false, insurer: "A" },
        { id: "b", domain: "health", sumInsured: 500_000, premium: 11_000, status: "ACTIVE", external: true, insurer: "B" },
      ],
    });
    const dup = gaps.find((g) => g.kind === "DUPLICATE");
    assert.ok(dup, "a duplicate should be found");
    assert.equal(dup.exposureValue, 11_000);
    assert.match(dup.explanation.why, /cancel/i);
    // And it must warn against cancelling the wrong one.
    assert.ok(dup.explanation.limitations.some((l) => /waiting period/i.test(l)));
  });

  test("multiple life policies are not a duplicate", async () => {
    const gaps = await analyse({
      userId: "u",
      age: 35,
      dependents: 2,
      incomeRange: "6L_12L",
      heldPolicies: [
        { id: "a", domain: "life", sumInsured: 5_000_000, status: "ACTIVE", external: true },
        { id: "b", domain: "life", sumInsured: 5_000_000, status: "ACTIVE", external: true },
      ],
    });
    assert.equal(gaps.filter((g) => g.kind === "DUPLICATE").length, 0);
  });

  test("underinsurance is measured against the computed need", async () => {
    const gaps = await analyse({
      userId: "u",
      age: 30,
      incomeRange: "12L_25L",
      dependents: 3,
      heldPolicies: [
        { id: "a", domain: "life", sumInsured: 1_000_000, status: "ACTIVE", external: true },
      ],
    });
    const under = gaps.find((g) => g.kind === "UNDERINSURED" && g.domain === "life");
    assert.ok(under, "10 lakh against a multi-crore need must be flagged");
    assert.equal(under.severity, "HIGH");
    assert.ok(under.exposureValue > 0);
  });

  test("a lapsed health policy is HIGH and explains the waiting-period loss", async () => {
    const gaps = await analyse({
      userId: "u",
      age: 45,
      heldPolicies: [
        { id: "a", domain: "health", sumInsured: 500_000, status: "LAPSED", external: true },
      ],
    });
    const lapsed = gaps.find((g) => g.kind === "LAPSED");
    assert.equal(lapsed.severity, "HIGH");
    assert.match(lapsed.explanation.risksOfInaction[0], /waiting period|exclu/i);
  });

  test("gaps come back most severe first", async () => {
    const gaps = await analyse({
      userId: "u",
      age: 45,
      incomeRange: "6L_12L",
      dependents: 2,
      vehicles: [{ kind: "CAR" }],
      properties: [{ kind: "HOUSE", ownership: "MORTGAGED" }],
    });
    const order = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
    for (let i = 1; i < gaps.length; i++) {
      assert.ok(order[gaps[i - 1].severity] <= order[gaps[i].severity], "gaps must be sorted by severity");
    }
  });
});

// ── Renewals ─────────────────────────────────────────────────────────────────

describe("renewal prediction", () => {
  const fixedNow = () => new Date("2026-06-01T00:00:00Z");
  const service = new RuleBasedRenewalPrediction(fixedNow);

  const withRenewal = (domain, iso, extra = {}) => ({
    userId: "u",
    heldPolicies: [
      { id: "p", domain, status: "ACTIVE", external: true, renewalDate: new Date(iso), ...extra },
    ],
  });

  test("reminder lead time differs by domain, because the decisions differ", async () => {
    const [health] = await service.forecast(withRenewal("health", "2026-09-01"));
    const [motor] = await service.forecast(withRenewal("motor", "2026-09-01"));

    const healthLead = (health.renewalDate - health.reminderOn) / 86_400_000;
    const motorLead = (motor.renewalDate - motor.reminderOn) / 86_400_000;
    assert.equal(healthLead, 45);
    assert.equal(motorLead, 21);
    assert.match(health.reminderRationale, /sum insured|no-claim/i);
  });

  test("an overdue renewal is CRITICAL and is still reported", async () => {
    const [overdue] = await service.forecast(withRenewal("health", "2026-05-01"));
    assert.ok(overdue.daysAway < 0);
    assert.equal(overdue.priority, "CRITICAL");
    assert.match(overdue.reminderRationale, /passed/i);
  });

  test("a small health cover suggests increasing it at renewal", async () => {
    const [forecast] = await service.forecast({
      userId: "u",
      familyMembers: 4,
      heldPolicies: [
        {
          id: "p",
          domain: "health",
          status: "ACTIVE",
          external: true,
          sumInsured: 300_000,
          renewalDate: new Date("2026-07-01"),
        },
      ],
    });
    assert.ok(forecast.coverageReviewSuggested);
    assert.ok(forecast.improvements.some((i) => /increase the sum insured/i.test(i)));
    assert.ok(forecast.improvements.some((i) => /shared across 4/i.test(i)));
  });

  test("health renewals mention portability's 45-day deadline", async () => {
    const [forecast] = await service.forecast(withRenewal("health", "2026-08-01"));
    assert.match(forecast.explanation.alternatives[0].whyNotChosen, /45 days/);
  });

  test("lapsed policies produce no forecast", async () => {
    const forecasts = await service.forecast({
      userId: "u",
      heldPolicies: [
        { id: "p", domain: "motor", status: "LAPSED", external: true, renewalDate: new Date("2026-07-01") },
      ],
    });
    assert.equal(forecasts.length, 0);
  });

  test("forecasts come back soonest first", async () => {
    const forecasts = await service.forecast({
      userId: "u",
      heldPolicies: [
        { id: "a", domain: "motor", status: "ACTIVE", external: true, renewalDate: new Date("2026-11-01") },
        { id: "b", domain: "health", status: "ACTIVE", external: true, renewalDate: new Date("2026-06-15") },
      ],
    });
    assert.ok(forecasts[0].daysAway < forecasts[1].daysAway);
  });
});

// ── Recommendations ──────────────────────────────────────────────────────────

describe("recommendations", () => {
  const engine = createIntelligenceEngine();

  test("nothing is recommended without a full explanation", async () => {
    const report = await engine.report({
      userId: "u",
      age: 35,
      incomeRange: "6L_12L",
      dependents: 2,
      vehicles: [{ kind: "CAR" }],
    });

    assert.ok(report.recommendations.length > 0);
    for (const rec of report.recommendations) {
      const e = rec.explanation;
      assert.ok(e.why, "why is required");
      assert.ok(e.how.length > 0, "how is required");
      assert.ok(e.benefits.length > 0, "benefits are required");
      assert.ok(e.limitations.length > 0, "limitations are required");
      assert.ok(e.risksOfInaction.length > 0, "risks of inaction are required");
      assert.ok(e.alternatives.length > 0, "an alternative is always required");
      assert.ok(typeof e.confidence.score === "number");
      assert.ok(rec.coverage.length > 0 && rec.idealFor);
    }
  });

  test("a premium estimate is always labelled as an estimate", async () => {
    const report = await engine.report({
      userId: "u",
      age: 30,
      incomeRange: "6L_12L",
      dependents: 2,
    });
    for (const rec of report.recommendations.filter((r) => r.estimatedAnnualPremium)) {
      assert.ok(
        rec.explanation.limitations.some((l) => /estimate.*not a quote/i.test(l)),
        "a premium range must be labelled an estimate, not a quote"
      );
    }
  });

  test("premium estimates are in the right order of magnitude", async () => {
    // Pinned deliberately. An estimate that is five times the real price tells
    // somebody they cannot afford cover that would cost them a few thousand
    // rupees a month, and "estimate, not a quote" does not make that harmless.
    const report = await engine.report({
      userId: "u",
      age: 38,
      incomeRange: "6L_12L",
      dependents: 4,
      familyMembers: 5,
      smoker: true,
    });

    const life = report.recommendations.find((r) => r.domain === "life");
    // ~1.5 crore of term cover for a 38-year-old smoker: tens of thousands a
    // year, not lakhs.
    assert.ok(
      life.estimatedAnnualPremium.high < 60_000,
      `term cover priced at ₹${life.estimatedAnnualPremium.high}/yr is far above the market`
    );
    assert.ok(life.estimatedAnnualPremium.low > 10_000);

    const health = report.recommendations.find((r) => r.domain === "health");
    // A family floater for five: tens of thousands, not over a lakh.
    assert.ok(
      health.estimatedAnnualPremium.high < 80_000,
      `family floater priced at ₹${health.estimatedAnnualPremium.high}/yr is far above the market`
    );
  });

  test("a non-smoker pays less than a smoker, all else equal", async () => {
    const base = { userId: "u", age: 38, incomeRange: "6L_12L", dependents: 3 };
    const smoker = await engine.report({ ...base, smoker: true });
    const clear = await engine.report({ ...base, smoker: false });
    const s = smoker.recommendations.find((r) => r.domain === "life").estimatedAnnualPremium.high;
    const c = clear.recommendations.find((r) => r.domain === "life").estimatedAnnualPremium.high;
    assert.ok(s > c, "smoking must raise the estimate");
  });

  test("the considered priority order is not overturned by a risk score", async () => {
    // A sole earner with several dependants has high family risk, which used to
    // push life cover above the health cover they need first. Health comes
    // first because a hospital bill arrives without warning.
    const report = await engine.report({
      userId: "u",
      age: 38,
      incomeRange: "6L_12L",
      dependents: 4,
      familyMembers: 5,
    });
    const health = report.recommendations.findIndex((r) => r.domain === "health");
    const life = report.recommendations.findIndex((r) => r.domain === "life");
    assert.ok(health >= 0 && life >= 0);
    assert.ok(health < life, "health must be recommended ahead of life for this household");
  });

  test("term cover is recommended over endowment, with the reason", async () => {
    const report = await engine.report({
      userId: "u",
      age: 32,
      incomeRange: "6L_12L",
      dependents: 2,
    });
    const life = report.recommendations.find((r) => r.domain === "life");
    const alt = life.explanation.alternatives.find((a) => /endowment|money-back/i.test(a.option));
    assert.ok(alt, "endowment must be named as the alternative it is");
    assert.match(alt.whyNotChosen, /term/i);
  });

  test("nothing is recommended in a domain the customer already covers adequately", async () => {
    const report = await engine.report({
      userId: "u",
      age: 30,
      incomeRange: "3L_6L",
      dependents: 0,
      familyMembers: 1,
      heldPolicies: [
        { id: "h", domain: "health", sumInsured: 1_000_000, status: "ACTIVE", external: true },
      ],
    });
    assert.equal(
      report.recommendations.filter((r) => r.domain === "health").length,
      0,
      "adequate health cover must not be re-recommended"
    );
  });

  test("recommendations are ordered by priority", async () => {
    const report = await engine.report({
      userId: "u",
      age: 45,
      incomeRange: "6L_12L",
      dependents: 3,
      vehicles: [{ kind: "CAR" }],
      properties: [{ kind: "HOUSE", ownership: "MORTGAGED" }],
    });
    for (let i = 1; i < report.recommendations.length; i++) {
      assert.ok(
        report.recommendations[i - 1].priorityScore >= report.recommendations[i].priorityScore
      );
    }
  });

  test("product matching declares itself unavailable instead of inventing a policy", async () => {
    const result = await new UnavailablePolicyMatching().match();
    assert.equal(result.available, false);
    assert.equal(result.matches.length, 0);
    assert.match(result.reason, /layer4|insurer API/i);
  });
});

// ── The composed report ──────────────────────────────────────────────────────

describe("the engine as a whole", () => {
  const engine = createIntelligenceEngine();

  test("an overdue renewal beats a new recommendation as the next action", async () => {
    // Keeping cover somebody has is worth more than selling cover they do not.
    const report = await engine.report({
      userId: "u",
      age: 40,
      incomeRange: "6L_12L",
      dependents: 2,
      vehicles: [{ kind: "CAR" }],
      heldPolicies: [
        {
          id: "p",
          domain: "health",
          status: "ACTIVE",
          external: true,
          sumInsured: 500_000,
          renewalDate: new Date(Date.now() - 5 * 86_400_000),
        },
      ],
    });
    assert.equal(report.nextBestAction.domain, "health");
    assert.match(report.nextBestAction.summary, /renewal date has passed/i);
  });

  test("a thin profile is asked for facts rather than sold something", async () => {
    // The engine can always produce a recommendation — everybody needs health
    // cover — so the test is not that it produces none. It is that it does not
    // *lead* with one derived from no facts, and that anything it does say
    // carries a confidence that admits how little it knows.
    const report = await engine.report({ userId: "u" });
    assert.match(report.nextBestAction.summary, /tell us a little more/i);
    assert.equal(report.nextBestAction.domain, null);
    assert.ok(report.profileCompleteness < 40);
    for (const rec of report.recommendations) {
      assert.ok(
        rec.explanation.confidence.score <= 0.3,
        `advice on a blank profile must not claim confidence (${rec.domain} was ${rec.explanation.confidence.score})`
      );
    }
  });

  test("the profile hash changes when a fact changes, and only then", async () => {
    const a = hashProfile({ userId: "u", age: 30 });
    const b = hashProfile({ userId: "u", age: 30 });
    const c = hashProfile({ userId: "u", age: 31 });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  test("services are injectable — the engine uses what it is given", async () => {
    const stub = {
      assess: async () => ({
        overall: "HIGH",
        overallScore: 99,
        factors: [],
        narrative: "stubbed",
        explanation: {
          why: "stub", how: [], benefits: [], limitations: [], risksOfInaction: [],
          alternatives: [], confidence: { score: 1, basis: [], improvedBy: [] },
        },
      }),
    };
    const injected = createIntelligenceEngine({ risk: stub });
    const report = await injected.report({ userId: "u", age: 30 });
    assert.equal(report.risk.narrative, "stubbed");
    assert.equal(report.risk.overall, "HIGH");
  });

  test("completeness is weighted, not a field count", () => {
    const age = profileCompleteness({ userId: "u", age: 30 });
    const city = profileCompleteness({ userId: "u", city: "Chennai" });
    assert.ok(age > city, "age must be worth more than city");
  });

  test("confidence names what would improve it", () => {
    const c = confidenceFrom({ userId: "u", age: 30 }, ["age", "incomeRange", "dependents"], ["age known"]);
    assert.ok(c.score > 0.15 && c.score < 0.95);
    assert.ok(c.improvedBy.some((s) => /income/i.test(s)));
  });
});

// ── Through the API, with permissions ────────────────────────────────────────

describe("the API and its permissions", () => {
  test("a customer builds a profile and gets a report", async () => {
    const customer = await account("owner");
    const c = api(customer.cookie);

    const saved = await c.put("/profile", {
      age: 34,
      incomeRange: "6L_12L",
      dependents: 2,
      familyMembers: 4,
      occupation: "software engineer",
      city: "Coimbatore",
      vehicles: [{ kind: "CAR", year: 2019 }],
    });
    assert.equal(saved.status, 200);
    assert.ok(saved.body.data.completeness > 50);

    const report = await c.get("/report");
    assert.equal(report.status, 200);
    assert.ok(report.body.data.recommendations.length > 0);
    assert.ok(report.body.data.nextBestAction.summary);
    assert.equal(report.body.data.need.lifeStage, "YOUNG_FAMILY");
  });

  test("a partial update does not erase what was saved before", async () => {
    // The AI updates a profile mid-conversation. Losing the customer's typed
    // answers would be invisible and permanent.
    const customer = await account("merge");
    const c = api(customer.cookie);

    await c.put("/profile", { age: 40, incomeRange: "12L_25L", occupation: "teacher" });
    await c.put("/profile", { dependents: 3 });

    const after = await c.get("/profile");
    assert.equal(after.body.data.profile.age, 40);
    assert.equal(after.body.data.profile.occupation, "teacher");
    assert.equal(after.body.data.profile.dependents, 3);
  });

  test("a customer cannot read another customer's analysis", async () => {
    const alice = await account("alice");
    const mallory = await account("mallory");
    await api(alice.cookie).put("/profile", { age: 30, incomeRange: "6L_12L" });

    // The id is accepted but not trusted. A customer holds no `customer.read`,
    // so naming somebody else is refused outright and audited — rather than
    // quietly returning their own report, which would hide the attempt.
    const res = await api(mallory.cookie).get(`/report?userId=${alice.userId}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");

    // Their own report still works.
    const own = await api(mallory.cookie).get("/report");
    assert.equal(own.status, 200);
    assert.equal(own.body.data.userId, mallory.userId);
  });

  test("a customer cannot read the business analytics", async () => {
    const customer = await account("nosy");
    for (const path of ["/analytics/overview", "/analytics/risk-distribution", "/analytics/renewals"]) {
      const res = await api(customer.cookie).get(path);
      assert.equal(res.status, 403, `${path} must be forbidden to a customer`);
    }
  });

  test("a customer cannot pull another customer's brief", async () => {
    const alice = await account("brief-subject");
    const customer = await account("brief-nosy");
    const res = await api(customer.cookie).get(`/customer/${alice.userId}/brief`);
    assert.equal(res.status, 403);
  });

  test("an employee gets a brief that leads with one thing to say", async () => {
    const alice = await account("advised");
    await api(alice.cookie).put("/profile", {
      age: 46,
      incomeRange: "6L_12L",
      dependents: 3,
      familyMembers: 5,
      vehicles: [{ kind: "TWO_WHEELER", year: 2012 }],
    });

    const officer = await account("advisor", "EMPLOYEE", "EMPLOYEE");
    const res = await api(officer.cookie).get(`/customer/${alice.userId}/brief`);
    assert.equal(res.status, 200);

    const brief = res.body.data;
    assert.equal(brief.customer.id, alice.userId);
    assert.ok(brief.openWith.summary, "an advisor needs one opening line");
    assert.ok(brief.suggestedPolicies.length > 0);
    // The employee must see the same reasoning the customer will.
    assert.ok(brief.suggestedPolicies[0].why);
    assert.ok(brief.suggestedPolicies[0].talkingPoints.length > 0);
    assert.ok(Array.isArray(brief.askAbout));
    // Claims are declared missing, never invented.
    assert.equal(brief.claimObservations.available, false);
  });

  test("held policies can be added and removed, and change the advice", async () => {
    const customer = await account("holder");
    const c = api(customer.cookie);
    await c.put("/profile", { age: 35, incomeRange: "6L_12L", dependents: 2, familyMembers: 4 });

    const before = await c.get("/report?fresh=true");
    const healthBefore = before.body.data.recommendations.filter((r) => r.domain === "health").length;

    const added = await c.post("/policies", {
      domain: "health",
      insurer: "Test Insurer",
      sumInsured: 2_000_000,
      renewalDate: "2027-01-01",
    });
    assert.equal(added.status, 201);

    const after = await c.get("/report?fresh=true");
    const healthAfter = after.body.data.recommendations.filter((r) => r.domain === "health").length;
    assert.ok(healthAfter < healthBefore || healthBefore === 0, "adding cover must reduce that recommendation");
    assert.equal(after.body.data.renewals.length, 1);

    const removed = await c.del(`/policies/${added.body.data.id}`);
    assert.equal(removed.status, 200);
  });

  test("another customer's policy id reads as absent, not forbidden", async () => {
    const alice = await account("pol-owner");
    const mallory = await account("pol-thief");
    const created = await api(alice.cookie).post("/policies", { domain: "motor" });
    await api(mallory.cookie).put("/profile", { age: 30 });

    const res = await api(mallory.cookie).del(`/policies/${created.body.data.id}`);
    assert.equal(res.status, 404, "404 rather than 403 — a 403 would confirm it exists");
  });

  test("an unknown insurance type is refused", async () => {
    const customer = await account("bad-domain");
    const res = await api(customer.cookie).post("/policies", { domain: "spaceship" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "UNKNOWN_DOMAIN");
  });

  test("a repeated report is served from the stored run", async () => {
    const customer = await account("cached");
    const c = api(customer.cookie);
    await c.put("/profile", { age: 30, incomeRange: "6L_12L", dependents: 1 });

    await c.get("/report?fresh=true");
    const second = await c.get("/report");
    assert.equal(second.status, 200);

    const history = await c.get("/history");
    assert.equal(history.status, 200);
    assert.ok(history.body.data.runs.length >= 1);
    assert.ok(history.body.data.runs[0].profileHash);
  });

  test("an admin sees aggregates, and honest gaps where data does not exist", async () => {
    const admin = await account("bizadmin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/analytics/overview");
    assert.equal(res.status, 200);

    const data = res.body.data;
    assert.ok(typeof data.profiles === "number");
    assert.ok(Array.isArray(data.mostRecommendedProducts));
    // Never fabricated.
    assert.equal(data.recommendationSuccess.available, false);
    assert.ok(data.recommendationSuccess.needs);
    assert.equal(data.customerTrends.available, false);
  });

  test("the risk heatmap is per dimension, not one number", async () => {
    const admin = await account("riskadmin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/analytics/risk-distribution");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.heatmap));
    assert.ok(res.body.data.note);
  });

  test("renewal analytics say what the premium figure excludes", async () => {
    const admin = await account("renewadmin", "ENTERPRISE", "ENTERPRISE_ADMIN");
    const res = await api(admin.cookie).get("/analytics/renewals");
    assert.equal(res.status, 200);
    assert.match(res.body.data.premiumAtRiskNote, /only the policies with a premium recorded/i);
    assert.equal(res.body.data.renewalRate.available, false);
  });

  test("signing out closes the whole surface", async () => {
    for (const path of ["/profile", "/report", "/analytics/overview"]) {
      const res = await request(app).get(`/api/v1/intelligence${path}`);
      assert.equal(res.status, 401, `${path} must require a session`);
    }
  });
});
