/**
 * The Knowledge & Memory Platform.
 *
 * Four properties decide whether this is safe, and they are what these tests
 * are for:
 *
 *  1. Nothing reaches a reader until a *second* person approves it, and an
 *     author cannot approve their own work.
 *  2. A restricted document is unreachable without an explicit grant — and
 *     returns 404, so its existence is not disclosed either.
 *  3. Institutional memory is never overwritten; a changed fact supersedes the
 *     old one, which stays readable.
 *  4. Memory scope is decided by who is asking, never by what they ask for.
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

const dbFile = path.join(os.tmpdir(), `aegis-knowledge-${Date.now()}-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
execSync("npx prisma migrate deploy", { stdio: "ignore" });

const assert = require("node:assert/strict");
const { test, describe, after } = require("node:test");
const request = require("supertest");
const app = require("../src/app");
const { PrismaClient } = require("@prisma/client");

const { knowledgeService, ensureCategories } = require("../src/services/knowledge.service");
const {
  memoryService,
  conversationMemoryService,
  organizationMemoryService,
} = require("../src/services/memory.service");
const {
  searchService,
  registerSearchService,
  resetSearchService,
} = require("../src/knowledge/search");
const { tokenise, stem, buildIndexEntries } = require("../src/knowledge/search");
const { knowledgeRouter, knowledgePermissionService } = require("../src/knowledge/router");
const { documentParser } = require("../src/knowledge/parsers");

const prisma = new PrismaClient();
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

after(async () => {
  await prisma.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const cookieHeader = (res) =>
  (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

let seq = 0;
async function account(tag, realm = "CUSTOMER", role = "CUSTOMER") {
  seq += 1;
  const email = `kb-${tag}-${Date.now()}-${seq}@test.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", ORIGIN)
    .send({ name: `Person ${tag}`, email, password: PASSWORD, passwordConfirm: PASSWORD });
  assert.equal(res.status, 201);
  const userId = res.body.data.user.id;

  if (realm !== "CUSTOMER" || role !== "CUSTOMER") {
    await prisma.user.update({
      where: { id: userId },
      data: { realm, role, emailVerifiedAt: new Date() },
    });
  }
  return { userId, email, cookie: cookieHeader(res), realm, role, id: userId };
}

const actorOf = (a) => ({ id: a.userId, role: a.role, realm: a.realm });

/**
 * An author can write but not approve; a reviewer can do both.
 *
 * These are real roles rather than invented ones: OPERATIONS holds
 * `knowledge.write` without `workflow.approve`, and ENTERPRISE_ADMIN holds
 * both. The separation the review step depends on already exists in the role
 * model — these tests pin it there rather than assuming it.
 */
const author = (tag) => account(tag, "EMPLOYEE", "OPERATIONS");
const reviewer = (tag) => account(tag, "ENTERPRISE", "ENTERPRISE_ADMIN");

/**
 * Somebody who may write about a customer.
 *
 * Memory about a person is customer data, so writing it needs `customer.write`.
 * In the existing role model only ENTERPRISE_ADMIN and PLATFORM_ADMIN hold that
 * — EMPLOYEE has `customer.read` alone. That is a Sprint 3 decision this sprint
 * does not change; it is noted as a gap rather than worked around here.
 */
const custodian = (tag) => account(tag, "ENTERPRISE", "ENTERPRISE_ADMIN");

const api = (cookie) => ({
  get: (p) => request(app).get(`/api/v1/knowledge${p}`).set("Cookie", cookie),
  post: (p, body) =>
    request(app).post(`/api/v1/knowledge${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  patch: (p, body) =>
    request(app).patch(`/api/v1/knowledge${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  del: (p) => request(app).delete(`/api/v1/knowledge${p}`).set("Origin", ORIGIN).set("Cookie", cookie),
});

const draft = (over = {}) => ({
  title: "Motor claim documents",
  category: "CLAIMS_SOP",
  summary: "The documents needed to settle a motor own-damage claim.",
  body: "A motor own-damage claim needs the registration certificate, the driving licence of the person driving, and photographs of the damage. Cashless repair is available at network garages.",
  tags: ["motor", "claims"],
  ...over,
});

/** Writes an article and takes it all the way to APPROVED. */
async function publish(authorAccount, reviewerAccount, over = {}) {
  const article = await knowledgeService.create(actorOf(authorAccount), draft(over));
  await knowledgeService.submitForReview(actorOf(authorAccount), article.id);
  return knowledgeService.review(actorOf(reviewerAccount), article.id, "APPROVED");
}

// ── Authoring and review ─────────────────────────────────────────────────────

describe("knowledge authoring and review", () => {
  test("a new article is a draft, never published by writing it", async () => {
    const a = await author("draft");
    const article = await knowledgeService.create(actorOf(a), draft());
    assert.equal(article.status, "DRAFT");
    assert.equal(article.version, 1);
    assert.equal(article.authorId, a.userId);
  });

  test("an author cannot approve their own article", async () => {
    // The whole point of the review step. Collapsing author and approver makes
    // it decorative.
    const a = await reviewer("self-approve");
    const article = await knowledgeService.create(actorOf(a), draft());
    await knowledgeService.submitForReview(actorOf(a), article.id);

    await assert.rejects(
      () => knowledgeService.review(actorOf(a), article.id, "APPROVED"),
      /somebody else has to approve/i
    );
  });

  test("writing does not confer approving", async () => {
    const a = await author("writer");
    const article = await knowledgeService.create(actorOf(a), draft());
    await knowledgeService.submitForReview(actorOf(a), article.id);

    await assert.rejects(
      () => knowledgeService.review(actorOf(a), article.id, "APPROVED"),
      /review authority/i
    );
  });

  test("a rejection must say what is wrong", async () => {
    const a = await author("reject-a");
    const r = await reviewer("reject-r");
    const article = await knowledgeService.create(actorOf(a), draft());
    await knowledgeService.submitForReview(actorOf(a), article.id);

    await assert.rejects(
      () => knowledgeService.review(actorOf(r), article.id, "REJECTED"),
      /leaves the author guessing/i
    );

    const rejected = await knowledgeService.review(
      actorOf(r),
      article.id,
      "REJECTED",
      "The cashless section is out of date since the 2026 circular."
    );
    assert.equal(rejected.status, "DRAFT");
  });

  test("approval records who approved it and when", async () => {
    const a = await author("approve-a");
    const r = await reviewer("approve-r");
    const approved = await publish(a, r);

    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.approvedById, r.userId);
    assert.ok(approved.approvedAt);
  });

  test("editing an approved article returns it to draft", async () => {
    // Guidance that changed without being re-reviewed is guidance nobody has
    // checked — leaving it APPROVED would let an edit bypass review entirely.
    const a = await author("edit-a");
    const r = await reviewer("edit-r");
    const approved = await publish(a, r);

    const edited = await knowledgeService.update(actorOf(a), approved.id, {
      body: "Completely different guidance.",
      changeNote: "Rewritten after the 2026 circular.",
    });

    assert.equal(edited.status, "DRAFT");
    assert.equal(edited.version, 2);
    assert.equal(edited.approvedById, null);
  });

  test("an edited article leaves the search index immediately", async () => {
    const a = await author("index-a");
    const r = await reviewer("index-r");
    const approved = await publish(a, r, { title: "Zebra crossing liability rules" });

    let hits = await searchService().search(actorOf(a), { text: "zebra" });
    assert.ok(hits.hits.length > 0, "the approved article should be findable");

    await knowledgeService.update(actorOf(a), approved.id, { body: "Rewritten." });

    hits = await searchService().search(actorOf(a), { text: "zebra" });
    assert.equal(hits.hits.length, 0, "an unapproved edit must not stay findable");
  });

  test("every content change is kept as a version", async () => {
    const a = await author("version-a");
    const r = await reviewer("version-r");
    const approved = await publish(a, r);

    await knowledgeService.update(actorOf(a), approved.id, {
      body: "Second version of the guidance.",
      changeNote: "Added the network garage list.",
    });

    const history = await knowledgeService.history(actorOf(a), approved.id);
    assert.ok(history.versions.length >= 1);
    assert.equal(history.versions[0].changeNote, "Added the network garage list.");
    // The version holds what it *was*, not what it became.
    assert.match(history.versions[0].summary, /motor own-damage claim/i);
  });

  test("archiving keeps the article and removes it from search", async () => {
    const a = await author("archive-a");
    const r = await reviewer("archive-r");
    const approved = await publish(a, r, { title: "Obsolete quokka procedure" });

    let hits = await searchService().search(actorOf(a), { text: "quokka" });
    assert.ok(hits.hits.length > 0);

    const archived = await knowledgeService.archive(
      actorOf(r),
      approved.id,
      "Superseded by the 2026 procedure."
    );
    assert.equal(archived.status, "ARCHIVED");

    hits = await searchService().search(actorOf(a), { text: "quokka" });
    assert.equal(hits.hits.length, 0, "withdrawn guidance must stop being findable");

    // But the row survives, so a past decision can still be explained.
    const still = await prisma.knowledgeArticle.findUnique({ where: { id: approved.id } });
    assert.ok(still);
  });

  test("archiving needs a reason", async () => {
    const a = await author("arch-reason-a");
    const r = await reviewer("arch-reason-r");
    const approved = await publish(a, r);
    await assert.rejects(
      () => knowledgeService.archive(actorOf(r), approved.id, "  "),
      /why this guidance is being withdrawn/i
    );
  });

  test("an article without a summary is refused", async () => {
    const a = await author("no-summary");
    await assert.rejects(
      () => knowledgeService.create(actorOf(a), draft({ summary: "" })),
      /search results and AI answers quote/i
    );
  });

  test("guidance cannot stop applying before it starts", async () => {
    const a = await author("window");
    await assert.rejects(
      () =>
        knowledgeService.create(
          actorOf(a),
          draft({ effectiveFrom: new Date("2026-06-01"), effectiveTo: new Date("2026-01-01") })
        ),
      /before it starts/i
    );
  });

  test("slugs stay unique without troubling the author", async () => {
    const a = await author("slug");
    const first = await knowledgeService.create(actorOf(a), draft({ title: "Renewal grace period" }));
    const second = await knowledgeService.create(actorOf(a), draft({ title: "Renewal grace period" }));
    assert.notEqual(first.slug, second.slug);
  });
});

// ── Visibility and permissions ───────────────────────────────────────────────

describe("knowledge visibility", () => {
  test("a draft is invisible to a reader who cannot edit", async () => {
    const a = await author("vis-a");
    const customer = await account("vis-cust");
    const article = await knowledgeService.create(actorOf(a), draft());

    await assert.rejects(
      () => knowledgeService.get(actorOf(customer), article.id),
      /does not exist/i
    );
  });

  test("a customer sees only PUBLIC guidance", async () => {
    const a = await author("class-a");
    const r = await reviewer("class-r");
    const customer = await account("class-cust");

    const internal = await publish(a, r, { title: "Internal escalation matrix" });
    const publicOne = await publish(a, r, {
      title: "How to make a motor claim",
      classification: "PUBLIC",
    });

    await assert.rejects(() => knowledgeService.get(actorOf(customer), internal.id), /does not exist/i);
    const visible = await knowledgeService.get(actorOf(customer), publicOne.id);
    assert.equal(visible.id, publicOne.id);
  });

  test("a restricted article is 404 without a grant, not 403", async () => {
    // A 403 confirms the document exists, which is itself the disclosure the
    // classification is there to prevent.
    const a = await author("restrict-a");
    const r = await reviewer("restrict-r");
    const staff = await author("restrict-staff");

    const restricted = await publish(a, r, {
      title: "Fraud investigation thresholds",
      classification: "RESTRICTED",
    });

    await assert.rejects(() => knowledgeService.get(actorOf(staff), restricted.id), /does not exist/i);
  });

  test("an explicit grant opens a restricted article", async () => {
    const a = await author("grant-a");
    const r = await reviewer("grant-r");
    const staff = await author("grant-staff");

    const restricted = await publish(a, r, {
      title: "Settlement authority limits",
      classification: "RESTRICTED",
    });

    await knowledgePermissionService.grant(actorOf(r), restricted.id, { userId: staff.userId });
    const seen = await knowledgeService.get(actorOf(staff), restricted.id);
    assert.equal(seen.id, restricted.id);
  });

  test("a revoked grant closes it again", async () => {
    const a = await author("revoke-a");
    const r = await reviewer("revoke-r");
    const staff = await author("revoke-staff");

    const restricted = await publish(a, r, {
      title: "Reinsurance treaty terms",
      classification: "RESTRICTED",
    });
    const grant = await knowledgePermissionService.grant(actorOf(r), restricted.id, {
      userId: staff.userId,
    });
    await knowledgeService.get(actorOf(staff), restricted.id);

    await knowledgePermissionService.revoke(actorOf(r), grant.id);
    await assert.rejects(() => knowledgeService.get(actorOf(staff), restricted.id), /does not exist/i);
  });

  test("a grant names either a person or a role, never both", async () => {
    const a = await author("grantee-a");
    const r = await reviewer("grantee-r");
    const article = await publish(a, r, { classification: "RESTRICTED" });

    await assert.rejects(
      () => knowledgePermissionService.grant(actorOf(r), article.id, { userId: a.userId, role: "EMPLOYEE" }),
      /either a person or a role/i
    );
    await assert.rejects(
      () => knowledgePermissionService.grant(actorOf(r), article.id, {}),
      /either a person or a role/i
    );
  });

  test("guidance outside its effective window is not served", async () => {
    const a = await author("window-a");
    const r = await reviewer("window-r");
    const expired = await publish(a, r, {
      title: "Superseded platypus circular",
      effectiveTo: new Date(Date.now() - 86_400_000),
    });

    await assert.rejects(() => knowledgeService.get(actorOf(a), expired.id), /does not exist/i);
    const hits = await searchService().search(actorOf(a), { text: "platypus" });
    assert.equal(hits.hits.length, 0, "superseded guidance must not answer a question");
  });
});

// ── Search ───────────────────────────────────────────────────────────────────

describe("lexical search", () => {
  test("tokenising keeps circular numbers intact", () => {
    // "IRDAI/HLT/2023-24" is the thing somebody actually searches for.
    const tokens = tokenise("IRDAI/HLT/2023-24 applies to health policies");
    assert.ok(tokens.some((t) => t.includes("irdai")));
    assert.ok(tokens.some((t) => t.includes("2023-24")));
  });

  test("stemming finds the singular from the plural", () => {
    assert.equal(stem("policies"), "policy");
    assert.equal(stem("claims"), "claim");
    assert.equal(stem("covering"), "cover");
  });

  test("a title match outranks a body match", async () => {
    const a = await author("rank-a");
    const r = await reviewer("rank-r");

    await publish(a, r, {
      title: "Wombat cover explained",
      summary: "About wombat cover.",
      body: "General text.",
    });
    await publish(a, r, {
      title: "Something else entirely",
      summary: "Unrelated.",
      body: "This mentions wombat once in passing.",
    });

    const result = await searchService().search(actorOf(a), { text: "wombat" });
    assert.equal(result.method, "LEXICAL");
    assert.ok(result.hits.length >= 2);
    assert.match(result.hits[0].title, /Wombat cover/);
  });

  test("scores are never negative, and never all identical", async () => {
    // A negative IDF inverts the ranking; a flat-zero IDF makes every hit tie,
    // which leaves the order to whatever the map yields — ten arbitrary
    // articles presented as the ten best.
    const a = await author("score-a");
    const r = await reviewer("score-r");

    await publish(a, r, { title: "Wolverine cover", summary: "Wolverine.", body: "wolverine text." });
    await publish(a, r, { title: "Unrelated", summary: "None.", body: "a passing wolverine mention." });

    const result = await searchService().search(actorOf(a), { text: "wolverine" });
    assert.ok(result.hits.length >= 2);
    assert.ok(result.hits.every((h) => h.score > 0), "no hit may score zero or below");

    const scores = result.hits.map((h) => h.score);
    assert.ok(new Set(scores).size > 1, "a title match must outscore a passing mention");
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i - 1] >= scores[i], "hits must come back in descending order");
    }
  });

  test("an empty result explains that search matches words, not meaning", async () => {
    const a = await author("empty-search");
    const result = await searchService().search(actorOf(a), { text: "narwhal actuarial pinniped" });
    assert.equal(result.hits.length, 0);
    assert.match(result.note, /matches words, not meaning/i);
  });

  test("a hit carries the sentence it matched in", async () => {
    const a = await author("excerpt-a");
    const r = await reviewer("excerpt-r");
    await publish(a, r, {
      title: "Capybara indemnity",
      body: "The first sentence is unrelated. Capybara indemnity covers third-party liability only. A third sentence follows.",
    });

    const result = await searchService().search(actorOf(a), { text: "capybara indemnity" });
    assert.ok(result.hits[0].excerpt);
    assert.match(result.hits[0].excerpt, /third-party liability/i);
  });

  test("search never returns a draft to somebody who cannot edit", async () => {
    const a = await author("search-draft-a");
    const customer = await account("search-draft-cust");
    await knowledgeService.create(actorOf(a), draft({ title: "Unapproved marmot guidance" }));

    const result = await searchService().search(actorOf(customer), { text: "marmot" });
    assert.equal(result.hits.length, 0);
  });

  test("index entries weight the fields differently", () => {
    const entries = buildIndexEntries({
      title: "Otter",
      summary: "Otter summary",
      body: "otter otter otter",
      tags: "otter",
    });
    const fields = new Set(entries.map((e) => e.field));
    assert.ok(fields.has("title") && fields.has("summary") && fields.has("body") && fields.has("tag"));
    const body = entries.find((e) => e.field === "body");
    assert.equal(body.frequency, 3);
  });
});

// ── The router ───────────────────────────────────────────────────────────────

describe("the injection seams", () => {
  test("the search service can be replaced without touching a caller", async () => {
    // The seam Phase A declared for a future semantic or hybrid implementation.
    // An extension point nobody has ever exercised is an extension point that
    // does not work, so this proves the swap rather than assuming it.
    const stub = {
      async search() {
        return { hits: [], method: "SEMANTIC", note: "stubbed", took: 0 };
      },
    };

    registerSearchService(stub);
    try {
      const result = await searchService().search({ id: "x", role: "OPERATIONS" }, { text: "anything" });
      assert.equal(result.method, "SEMANTIC");
      assert.equal(result.note, "stubbed");
    } finally {
      resetSearchService();
    }

    // And the real one is back.
    const real = await searchService().search({ id: "x", role: "OPERATIONS" }, { text: "anything" });
    assert.equal(real.method, "LEXICAL");
  });
});

describe("the knowledge router", () => {
  const route = (q, ctx) => knowledgeRouter().route(q, ctx);

  test("a regulation question goes to the knowledge base even when phrased personally", () => {
    const decision = route("does IRDAI let me port my policy", { hasCustomer: true });
    assert.equal(decision.source, "KNOWLEDGE_BASE");
    assert.match(decision.why, /rule, circular or procedure/i);
  });

  test("a personal question goes to memory when there is a customer", () => {
    assert.equal(route("what is my sum insured", { hasCustomer: true }).source, "MEMORY");
  });

  test("a personal question with nobody in context is refused, not guessed", () => {
    // Answering from general guidance would produce something that sounds
    // personal and is not.
    const decision = route("what is my sum insured", { hasCustomer: false });
    assert.equal(decision.source, "NONE");
    assert.match(decision.why, /no customer is in context/i);
  });

  test("an advice question goes to the intelligence engine", () => {
    assert.equal(route("should i increase my health cover", { hasCustomer: true }).source, "INTELLIGENCE");
  });

  test("a document question goes to the document platform", () => {
    assert.equal(route("did my rc book upload work", { hasCustomer: true }).source, "DOCUMENTS");
  });

  test("every decision explains itself and offers alternates", () => {
    const decision = route("how does a motor claim work");
    assert.ok(decision.why.length > 10);
    assert.ok(Array.isArray(decision.alternates));
    assert.ok(decision.confidence > 0 && decision.confidence <= 1);
  });
});

// ── Institutional memory ─────────────────────────────────────────────────────

describe("institutional memory", () => {
  test("a fact carries its provenance", async () => {
    const staff = await custodian("mem-a");
    const customer = await account("mem-subject");

    const fact = await memoryService.remember(actorOf(staff), {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "PREFERENCE",
      key: "contact.preferred_channel",
      value: "phone",
      source: "CUSTOMER_STATED",
      sourceRef: "conversation:abc",
    });

    assert.equal(fact.value, "phone");
    assert.equal(fact.source, "CUSTOMER_STATED");
    assert.equal(fact.confidence, 1);
  });

  test("an AI-inferred fact defaults to lower confidence than a stated one", async () => {
    // Advice built on an inference must not sound as certain as advice built on
    // something the customer confirmed.
    const staff = await custodian("mem-conf");
    const customer = await account("mem-conf-subject");

    const inferred = await memoryService.remember(actorOf(staff), {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "FACT",
      key: "household.likely_size",
      value: 4,
      source: "AI_INFERRED",
    });
    assert.ok(inferred.confidence < 1);
  });

  test("a changed fact supersedes rather than overwrites", async () => {
    const staff = await custodian("mem-supersede");
    const customer = await account("mem-supersede-subject");
    const target = { scope: "CUSTOMER", subjectId: customer.userId, kind: "PREFERENCE", key: "contact.preferred_channel" };

    await memoryService.remember(actorOf(staff), { ...target, value: "email", source: "CUSTOMER_STATED" });
    await memoryService.remember(actorOf(staff), { ...target, value: "phone", source: "CUSTOMER_STATED" });

    const live = await memoryService.recall(actorOf(staff), "CUSTOMER", customer.userId);
    const channel = live.filter((f) => f.key === "contact.preferred_channel");
    assert.equal(channel.length, 1, "only one live value per key");
    assert.equal(channel[0].value, "phone");

    // The old value is still there, and still explains a decision made on it.
    const history = await memoryService.keyHistory(
      actorOf(staff),
      "CUSTOMER",
      customer.userId,
      "contact.preferred_channel"
    );
    assert.equal(history.entries.length, 2);
    assert.equal(history.entries[0].current, true);
    assert.equal(history.entries[1].current, false);
    assert.equal(history.entries[1].value, "email");
  });

  test("re-asserting the same value does not create a new row", async () => {
    // An AI re-deriving the same fact each turn would otherwise bury the real
    // history under identical entries.
    const staff = await custodian("mem-idem");
    const customer = await account("mem-idem-subject");
    const target = { scope: "CUSTOMER", subjectId: customer.userId, kind: "FACT", key: "vehicle.count" };

    const first = await memoryService.remember(actorOf(staff), { ...target, value: 2 });
    const second = await memoryService.remember(actorOf(staff), { ...target, value: 2 });
    assert.equal(first.id, second.id);
  });

  test("an expired fact is not recalled", async () => {
    const staff = await custodian("mem-expiry");
    const customer = await account("mem-expiry-subject");

    await memoryService.remember(actorOf(staff), {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "CONTEXT",
      key: "session.last_intent",
      value: "renewal",
      expiresAt: new Date(Date.now() - 1000),
    });

    const live = await memoryService.recall(actorOf(staff), "CUSTOMER", customer.userId);
    assert.ok(!live.some((f) => f.key === "session.last_intent"));
  });

  test("a malformed key is refused", async () => {
    const staff = await custodian("mem-key");
    const customer = await account("mem-key-subject");
    await assert.rejects(
      () =>
        memoryService.remember(actorOf(staff), {
          scope: "CUSTOMER",
          subjectId: customer.userId,
          kind: "FACT",
          key: "Some Random Key!",
          value: 1,
        }),
      /lower case, dot separated/i
    );
  });

  test("a customer reads their own memory but cannot rewrite it", async () => {
    // Editing the platform's record of what it inferred about you is editing
    // evidence; a correction goes through an advisor.
    const staff = await custodian("mem-self-staff");
    const customer = await account("mem-self");

    await memoryService.remember(actorOf(staff), {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "FACT",
      key: "claim.prior_count",
      value: 3,
      source: "SYSTEM",
    });

    const own = await memoryService.recall(actorOf(customer), "CUSTOMER", customer.userId);
    assert.ok(own.some((f) => f.key === "claim.prior_count"));

    await assert.rejects(
      () =>
        memoryService.remember(actorOf(customer), {
          scope: "CUSTOMER",
          subjectId: customer.userId,
          kind: "FACT",
          key: "claim.prior_count",
          value: 0,
        }),
      /do not have access/i
    );
  });

  test("a customer cannot read another customer's memory", async () => {
    const staff = await custodian("mem-iso-staff");
    const alice = await account("mem-iso-a");
    const mallory = await account("mem-iso-b");

    await memoryService.remember(actorOf(staff), {
      scope: "CUSTOMER",
      subjectId: alice.userId,
      kind: "FACT",
      key: "policy.count",
      value: 2,
    });

    await assert.rejects(
      () => memoryService.recall(actorOf(mallory), "CUSTOMER", alice.userId),
      /do not have access/i
    );
  });

  test("organisation memory is staff-only", async () => {
    const customer = await account("org-cust");
    await assert.rejects(
      () => organizationMemoryService.recall(actorOf(customer), "org-1"),
      /do not have access/i
    );
  });

  test("platform memory needs a platform operator", async () => {
    const admin = await reviewer("plat-admin");
    await assert.rejects(
      () =>
        memoryService.remember(actorOf(admin), {
          scope: "PLATFORM",
          subjectId: "global",
          kind: "CONTEXT",
          key: "system.mode",
          value: "normal",
        }),
      /do not have access/i
    );

    const operator = await account("plat-op", "PLATFORM", "PLATFORM_ADMIN");
    const fact = await memoryService.remember(actorOf(operator), {
      scope: "PLATFORM",
      subjectId: "global",
      kind: "CONTEXT",
      key: "system.mode",
      value: "normal",
    });
    assert.equal(fact.value, "normal");
  });

  test("an export includes superseded records", async () => {
    // Somebody asking what is held about them is owed what is actually held,
    // not the tidied version.
    const staff = await custodian("export-staff");
    const customer = await account("export-subject");
    const target = { scope: "CUSTOMER", subjectId: customer.userId, kind: "PREFERENCE", key: "contact.language" };

    await memoryService.remember(actorOf(staff), { ...target, value: "en" });
    await memoryService.remember(actorOf(staff), { ...target, value: "ta" });

    const exported = await memoryService.export(actorOf(customer), "CUSTOMER", customer.userId);
    assert.equal(exported.records.length, 2);
    assert.ok(exported.records.some((r) => r.current === false));
  });

  test("forgetting removes the history too", async () => {
    const staff = await custodian("forget-staff");
    const customer = await account("forget-subject");
    const target = { scope: "CUSTOMER", subjectId: customer.userId, kind: "FACT", key: "health.condition" };

    await memoryService.remember(actorOf(staff), { ...target, value: "a" });
    await memoryService.remember(actorOf(staff), { ...target, value: "b" });

    const result = await memoryService.forget(actorOf(staff), "CUSTOMER", customer.userId, "health.condition");
    assert.equal(result.forgotten, 2);

    const after = await memoryService.recall(actorOf(staff), "CUSTOMER", customer.userId);
    assert.ok(!after.some((f) => f.key === "health.condition"));
  });
});

// ── Conversation memory ──────────────────────────────────────────────────────

describe("conversation memory", () => {
  test("a pinned note survives a sweep; an expired one does not", async () => {
    const staff = await custodian("conv-sweep");
    const session = `session-${Date.now()}`;

    await conversationMemoryService.note(actorOf(staff), {
      sessionRef: session,
      kind: "ESTABLISHED_FACT",
      label: "Budget stated",
      value: "₹15,000 a year",
      pinned: true,
      ttlMinutes: -1,
    });
    await conversationMemoryService.note(actorOf(staff), {
      sessionRef: session,
      kind: "OPEN_QUESTION",
      label: "Ephemeral",
      value: "x",
      ttlMinutes: -1,
    });

    await conversationMemoryService.sweep();
    const remaining = await conversationMemoryService.forSession(actorOf(staff), session);
    assert.equal(remaining.entries.length, 1);
    assert.equal(remaining.entries[0].label, "Budget stated");
  });

  test("promoting writes an institutional fact with the conversation as its source", async () => {
    // The bridge between working memory and institutional memory — explicit,
    // never automatic.
    const staff = await custodian("promote-staff");
    const customer = await account("promote-subject");
    const session = `session-${Date.now()}-p`;

    const note = await conversationMemoryService.note(actorOf(staff), {
      sessionRef: session,
      kind: "ESTABLISHED_FACT",
      label: "Prefers Tamil",
      value: "ta",
      userId: customer.userId,
    });

    const fact = await conversationMemoryService.promote(actorOf(staff), note.id, {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "PREFERENCE",
      key: "contact.language",
    });

    assert.equal(fact.value, "ta");
    assert.equal(fact.sourceRef, `conversation:${session}`);
    assert.equal(fact.source, "ADVISOR_ENTERED");

    const reloaded = await conversationMemoryService.forSession(actorOf(staff), session);
    assert.equal(reloaded.entries[0].retention, "PROMOTED");
    assert.equal(reloaded.entries[0].promotedRecordId, fact.id);
  });

  test("another customer cannot read a session", async () => {
    const staff = await custodian("conv-iso-staff");
    const alice = await account("conv-iso-a");
    const mallory = await account("conv-iso-b");
    const session = `session-${Date.now()}-iso`;

    await conversationMemoryService.note(actorOf(staff), {
      sessionRef: session,
      kind: "SUMMARY",
      label: "Alice's call",
      value: "…",
      userId: alice.userId,
    });

    await assert.rejects(
      () => conversationMemoryService.forSession(actorOf(mallory), session),
      /do not have access/i
    );
  });
});

// ── Parsing ──────────────────────────────────────────────────────────────────

describe("document parsing", () => {
  test("markdown is split into sections", async () => {
    const result = await documentParser().parse({
      filename: "circular.md",
      mimeType: "text/markdown",
      text: "# Free look period\nFifteen days.\n\n# Portability\nForty-five days before renewal.",
    });
    assert.equal(result.ok, true);
    assert.equal(result.sections.length, 2);
    assert.equal(result.title, "Free look period");
  });

  test("numbered regulatory clauses are recognised as headings", async () => {
    // The style regulators actually use; a markdown-only splitter misses it on
    // exactly the documents that matter most.
    const result = await documentParser().parse({
      filename: "irdai.txt",
      mimeType: "text/plain",
      text: "3.2 Free Look Period\nA policyholder may return the policy.\n3.3 Grace Period\nThirty days.",
    });
    assert.equal(result.ok, true);
    assert.ok(result.sections.some((s) => s.heading.startsWith("3.2")));
  });

  test("a PDF is refused with a reason rather than half-parsed", async () => {
    const result = await documentParser().parse({
      filename: "circular.pdf",
      mimeType: "application/pdf",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /No parser is configured/i);
    assert.match(result.reason, /worse than none/i);
  });
});

// ── The API ──────────────────────────────────────────────────────────────────

describe("the API and its permissions", () => {
  test("everything needs a session", async () => {
    for (const p of ["/articles", "/search?q=motor", "/categories", "/analytics"]) {
      const res = await request(app).get(`/api/v1/knowledge${p}`);
      assert.equal(res.status, 401, `${p} must require a session`);
    }
  });

  test("a customer cannot write knowledge", async () => {
    const customer = await account("api-cust");
    const res = await api(customer.cookie).post("/articles", draft());
    assert.equal(res.status, 403);
  });

  test("a customer cannot read knowledge analytics", async () => {
    const customer = await account("api-cust2");
    assert.equal((await api(customer.cookie).get("/analytics")).status, 403);
  });

  test("the twelve domain categories seed idempotently", async () => {
    const first = await ensureCategories();
    const second = await ensureCategories();
    assert.equal(first, 12);
    assert.equal(second, 12);

    const stored = await prisma.knowledgeCategory.count();
    assert.equal(stored, 12, "seeding twice must not duplicate");
  });

  test("an unknown review decision fails with a fail envelope, not a success one", async () => {
    // A 400 carrying { status: "success" } is read as success by any client
    // that checks the envelope rather than the status code.
    const a = await author("bad-decision-a");
    const r = await reviewer("bad-decision-r");
    const created = await api(a.cookie).post("/articles", draft());
    const id = created.body.data.id;
    await api(a.cookie).post(`/articles/${id}/submit`, {});

    const res = await api(r.cookie).post(`/articles/${id}/review`, { decision: "MAYBE" });
    assert.equal(res.status, 400);
    assert.equal(res.body.status, "fail");
    assert.equal(res.body.code, "UNKNOWN_DECISION");
  });

  test("a full authoring lifecycle works over HTTP", async () => {
    const a = await author("api-flow-a");
    const r = await reviewer("api-flow-r");

    const created = await api(a.cookie).post("/articles", draft({ title: "Renewal SOP over HTTP" }));
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "DRAFT");
    const id = created.body.data.id;

    assert.equal((await api(a.cookie).post(`/articles/${id}/submit`, {})).status, 200);

    const reviewed = await api(r.cookie).post(`/articles/${id}/review`, { decision: "APPROVED" });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, "APPROVED");

    const found = await api(a.cookie).get("/search?q=renewal%20sop");
    assert.equal(found.status, 200);
    assert.equal(found.body.data.method, "LEXICAL");
    assert.ok(found.body.data.hits.some((h) => h.id === id));

    const history = await api(a.cookie).get(`/articles/${id}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.data.currentVersion, 1);
  });

  test("the router is reachable so an assistant never queries storage directly", async () => {
    const staff = await author("api-route");
    const res = await api(staff.cookie).post("/route", {
      question: "what does the IRDAI circular say about free look",
      hasCustomer: false,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, "KNOWLEDGE_BASE");
    assert.ok(res.body.data.why);
  });

  test("analytics lead with what needs attention and never invent search metrics", async () => {
    const a = await author("api-analytics");
    const res = await api(a.cookie).get("/analytics");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.needsAttention);
    assert.equal(res.body.data.searchEffectiveness.available, false);
    assert.ok(res.body.data.searchEffectiveness.needs);
  });

  test("memory over HTTP respects scope", async () => {
    const staff = await custodian("api-mem-staff");
    const customer = await account("api-mem-cust");

    const written = await api(staff.cookie).post("/memory", {
      scope: "CUSTOMER",
      subjectId: customer.userId,
      kind: "PREFERENCE",
      key: "contact.preferred_time",
      value: "evening",
      source: "CUSTOMER_STATED",
    });
    assert.equal(written.status, 201);

    const own = await api(customer.cookie).get(`/memory/CUSTOMER/${customer.userId}`);
    assert.equal(own.status, 200);
    assert.ok(own.body.data.facts.some((f) => f.key === "contact.preferred_time"));

    const other = await account("api-mem-other");
    const denied = await api(other.cookie).get(`/memory/CUSTOMER/${customer.userId}`);
    assert.equal(denied.status, 403);
  });
});
