/**
 * Aegis Kural Lite: what it answers, what it refuses, and where the words came from.
 *
 * Three properties carry the weight here, and none of them is "does it answer
 * correctly" in the usual sense.
 *
 * **It must be able to say no.** An assistant that always returns its best
 * guess will answer "does this cover flood damage?" with the no-claim-bonus
 * entry, confidently, to somebody deciding whether they are insured. Most of the
 * matcher tests below are questions it must decline.
 *
 * **Its answers must be traceable.** Each one records where it came from, and
 * the entries that claim to quote the approved knowledge base are checked
 * against those files character for character.
 *
 * **It must not claim cover.** The entries written for this catalogue rather
 * than quoted from somewhere are held to a stricter rule than the quoted ones,
 * and that rule is asserted rather than reviewed.
 */
process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const {
  KURAL_ENTRIES,
  KURAL_TOPICS,
  isKuralTopic,
  kuralEntry,
} = require("../src/consumer/kural/topics");
const {
  MATCH_THRESHOLD,
  MAX_QUESTION_LENGTH,
  containsTerm,
  matchQuestion,
  normalise,
  relatedTopics,
} = require("../src/consumer/kural/match");
const {
  CONSUMER_LOCALES,
  KURAL_HUMAN_CTA,
  KURAL_INTRO,
  KURAL_NO_MATCH,
  KURAL_SCOPE_NOTE,
  KURAL_UNREADABLE,
  localise,
  resolveKuralCopy,
} = require("../src/consumer/messages");

const REPO = path.join(__dirname, "..", "..");

// ── The six topics ───────────────────────────────────────────────────────────

describe("the catalogue", () => {
  test("holds exactly the six topics the milestone names", () => {
    assert.deepEqual(
      [...KURAL_TOPICS],
      ["POLICY_EXPIRY", "COVER_TYPES", "IDV", "NCB", "ZERO_DEPRECIATION", "RENEWAL_STEPS"]
    );
    assert.equal(KURAL_ENTRIES.length, KURAL_TOPICS.length);
    assert.ok(isKuralTopic("IDV"));
    assert.ok(!isKuralTopic("CLAIMS"));
  });

  test("every topic has an answer in all three languages", () => {
    for (const entry of KURAL_ENTRIES) {
      for (const locale of CONSUMER_LOCALES) {
        assert.ok(
          localise(entry.answer, locale).length > 80,
          `${entry.id}/${locale} is too short to be an answer`
        );
        assert.ok(localise(entry.title, locale).length > 0, `${entry.id}/${locale} has no title`);
      }
    }
  });

  test("every topic records where its answer came from", () => {
    for (const entry of KURAL_ENTRIES) {
      assert.ok(entry.source, `${entry.id} has no provenance`);
      assert.ok(
        ["layer1", "aegis-copy", "aegis-editorial"].includes(entry.source.kind),
        `${entry.id} has an unknown source kind: ${entry.source.kind}`
      );
    }
  });

  test("no answer offers a price, a quote or a payment", () => {
    // None of those exist anywhere in Phase 1, and an assistant that implies one
    // is a promise the rest of the product cannot keep.
    for (const entry of KURAL_ENTRIES) {
      for (const locale of CONSUMER_LOCALES) {
        const text = localise(entry.answer, locale).toLowerCase();
        for (const word of ["quote", "buy now", "cheapest", "best price", "discount code"]) {
          assert.ok(!text.includes(word), `${entry.id}/${locale} mentions "${word}"`);
        }
      }
    }
  });

  test("no answer states what the customer's own policy covers", () => {
    // The distinction the whole design rests on: general information about
    // motor insurance, never a statement about the policy in front of them.
    for (const entry of KURAL_ENTRIES) {
      const text = localise(entry.answer, "en").toLowerCase();
      for (const claim of ["your policy covers", "you are covered for", "your cover includes"]) {
        assert.ok(!text.includes(claim), `${entry.id} claims cover: "${claim}"`);
      }
    }
  });
});

// ── Provenance ───────────────────────────────────────────────────────────────

describe("where the answers came from", () => {
  test("every layer1 answer really is in the approved knowledge base", () => {
    // Read from disk rather than trusted. A catalogue that claims to quote a
    // source and has drifted from it is worse than one that claims nothing.
    for (const entry of KURAL_ENTRIES) {
      if (entry.source.kind !== "layer1") continue;

      const file = path.join(REPO, entry.source.file);
      assert.ok(fs.existsSync(file), `${entry.id} names a file that does not exist: ${file}`);

      const contents = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(contents.faqs)) {
        const found = contents.faqs.find((faq) => faq.question === entry.source.question);
        assert.ok(found, `${entry.id}: "${entry.source.question}" is not in ${entry.source.file}`);
        // The source sentence has to survive into the answer. The answer says
        // more — it has to be readable by somebody who has never heard the term
        // — but it may not contradict what it quotes.
        const sourceWords = found.answer.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/);
        const answer = localise(entry.answer, "en").toLowerCase();
        const carried = sourceWords.filter((w) => w.length > 4 && answer.includes(w));
        assert.ok(
          carried.length >= 3,
          `${entry.id} does not carry its source: ${found.answer}`
        );
      } else {
        assert.ok(
          Object.prototype.hasOwnProperty.call(contents, entry.source.question),
          `${entry.id}: "${entry.source.question}" is not a key in ${entry.source.file}`
        );
      }
    }
  });

  test("the expiry answer matches the renewal rules it quotes", () => {
    const rules = JSON.parse(
      fs.readFileSync(
        path.join(REPO, "Aegis-AI/layer1/insurance-data/motor/two-wheeler/knowledge/rules.json"),
        "utf8"
      )
    );
    const answer = localise(kuralEntry("POLICY_EXPIRY").answer, "en");
    // "30 Days" in the source, "30 days" in the answer.
    assert.match(rules.renewal_rules.grace_period, /30/);
    assert.match(answer, /30 days/i);
    assert.equal(rules.renewal_rules.inspection_required_after_expiry, true);
    assert.match(answer, /inspect/i);
  });

  test("the cover-type answer matches the words the form already uses", () => {
    // The same customer reads these sentences when choosing their policy type.
    // Two answers to one question is how a product stops being trusted.
    const vocabulary = fs.readFileSync(
      path.join(REPO, "frontend/src/lib/consumer/vocabulary.ts"),
      "utf8"
    );
    const answer = localise(kuralEntry("COVER_TYPES").answer, "en");
    assert.ok(
      vocabulary.includes("Covers damage you cause to other people and their property."),
      "the source sentence has moved"
    );
    assert.match(answer, /damage you cause to other people and their property/);
    assert.match(answer, /including theft/);
  });

  test("an editorial answer is only ever a definition", () => {
    // The stricter rule. `aegis-editorial` is permitted for facts like what an
    // acronym stands for, and for nothing that describes what a policy pays.
    for (const entry of KURAL_ENTRIES) {
      if (entry.source.kind !== "aegis-editorial") continue;
      assert.ok(entry.source.note.length > 30, `${entry.id} has no reasoning recorded`);

      const text = localise(entry.answer, "en").toLowerCase();
      for (const phrase of ["is covered", "we cover", "covers you", "will pay you", "guaranteed"]) {
        assert.ok(!text.includes(phrase), `${entry.id} makes a coverage claim: "${phrase}"`);
      }
    }
  });

  test("only IDV and NCB are editorial, because only they are missing upstream", () => {
    const editorial = KURAL_ENTRIES.filter((e) => e.source.kind === "aegis-editorial").map((e) => e.id);
    assert.deepEqual(editorial.sort(), ["IDV", "NCB"]);
  });
});

// ── Matching ─────────────────────────────────────────────────────────────────

const answers = (question) => matchQuestion(question)?.topic ?? null;

describe("questions it recognises", () => {
  const cases = [
    ["When does my policy expire?", "POLICY_EXPIRY"],
    ["my insurance has expired what now", "POLICY_EXPIRY"],
    ["what is the difference between third party and comprehensive", "COVER_TYPES"],
    ["should i take comprehensive cover", "COVER_TYPES"],
    ["what is IDV", "IDV"],
    ["explain insured declared value please", "IDV"],
    ["what is ncb", "NCB"],
    ["will i lose my no claim bonus", "NCB"],
    ["what is zero depreciation", "ZERO_DEPRECIATION"],
    ["is bumper to bumper worth it", "ZERO_DEPRECIATION"],
    ["how do i renew my policy", "RENEWAL_STEPS"],
    ["renewal next steps", "RENEWAL_STEPS"],
  ];

  for (const [question, expected] of cases) {
    test(`"${question}" → ${expected}`, () => {
      assert.equal(answers(question), expected, `matched ${JSON.stringify(matchQuestion(question))}`);
    });
  }

  test("it reads Thanglish, not only English", () => {
    // Somebody asking "vandi value enna" is asking about IDV. A matcher that
    // only knows the acronym sends them to a human for a question it can answer.
    assert.equal(answers("en policy eppo mudiyum"), "POLICY_EXPIRY");
    assert.equal(answers("renew panna eppadi"), "RENEWAL_STEPS");
  });

  test("it reads Tamil script too", () => {
    assert.equal(answers("என் பாலிசி காலாவதி எப்போது"), "POLICY_EXPIRY");
  });

  test("punctuation and case do not decide the answer", () => {
    assert.equal(answers("WHAT IS I.D.V.?"), "IDV");
    assert.equal(answers("third-party vs comprehensive!!!"), "COVER_TYPES");
  });

  test("the longer, more specific term wins a tie", () => {
    // "zero depreciation" and "depreciation" both hit; answering the general
    // one would be technically defensible and unhelpful.
    assert.equal(answers("tell me about zero depreciation and depreciation"), "ZERO_DEPRECIATION");
  });
});

describe("questions it must decline", () => {
  const outside = [
    "does my policy cover flood damage",
    "what is the cheapest policy for a swift",
    "can i claim for a cracked windscreen",
    "how do i file a claim after an accident",
    "is my wife covered to drive my car",
    "what is health insurance",
    "hello",
    "asdfghjkl",
  ];

  for (const question of outside) {
    test(`"${question}" gets no answer rather than a wrong one`, () => {
      assert.equal(answers(question), null, `matched ${JSON.stringify(matchQuestion(question))}`);
    });
  }

  test("a single ordinary word is never enough", () => {
    // "cover" appears in questions about every topic here and half the ones
    // that are not. Answering on it alone is how a matcher becomes confidently
    // wrong.
    assert.equal(answers("cover"), null);
    assert.equal(answers("discount"), null);
    assert.equal(matchQuestion("what is idv").score >= MATCH_THRESHOLD, true);
  });

  test("an empty or absurd question is refused rather than guessed at", () => {
    assert.equal(matchQuestion(""), null);
    assert.equal(matchQuestion("   "), null);
    assert.equal(matchQuestion("idv ".repeat(MAX_QUESTION_LENGTH)), null);
    assert.equal(matchQuestion(null), null);
    assert.equal(matchQuestion(undefined), null);
  });

  test("a keyword inside a longer word does not count", () => {
    // "ncb" must not match "syncbase"; whole words only.
    assert.equal(containsTerm(normalise("syncbase troubles"), "ncb"), false);
    assert.equal(containsTerm(normalise("what is ncb"), "ncb"), true);
  });
});

describe("suggesting what it could have answered", () => {
  test("it offers the topics a near-miss brushed against", () => {
    const related = relatedTopics("does my comprehensive cover flood damage", 2);
    assert.ok(related.includes("COVER_TYPES"), JSON.stringify(related));
  });

  test("it offers nothing when a question touches nothing", () => {
    assert.deepEqual([...relatedTopics("asdfghjkl", 2)], []);
  });
});

// ── The words around every answer ────────────────────────────────────────────

describe("what travels with every answer", () => {
  test("the scope note says this is not about their own policy", () => {
    assert.match(localise(KURAL_SCOPE_NOTE, "en"), /not a statement about your own policy/i);
    for (const locale of CONSUMER_LOCALES) {
      assert.ok(localise(KURAL_SCOPE_NOTE, locale).length > 40, locale);
    }
  });

  test("a person is always offered", () => {
    assert.match(localise(KURAL_HUMAN_CTA, "en"), /person/i);
    const copy = resolveKuralCopy("en");
    assert.ok(copy.humanCta.length > 0 && copy.scopeNote.length > 0);
    assert.ok(copy.copyVersion.length > 0);
  });

  test("the refusal names its limits before offering anything else", () => {
    const text = localise(KURAL_NO_MATCH, "en");
    assert.ok(
      text.toLowerCase().indexOf("do not have") < text.toLowerCase().indexOf("i can only help"),
      "a reply that opens with other subjects reads as a deflection"
    );
    // And it names all six, so the customer learns the boundary in one go.
    for (const word of ["runs out", "third-party", "IDV", "no-claim", "zero depreciation", "renewing"]) {
      assert.ok(text.includes(word), `the refusal does not mention ${word}`);
    }
  });

  test("the introduction admits its limits in its first sentence", () => {
    // An assistant that opens by offering to help with anything breaks that
    // promise within two questions, on the person least able to tell.
    assert.match(localise(KURAL_INTRO, "en"), /checked notes/i);
  });

  test("every one of these lines exists in all three languages", () => {
    for (const text of [KURAL_SCOPE_NOTE, KURAL_HUMAN_CTA, KURAL_NO_MATCH, KURAL_UNREADABLE, KURAL_INTRO]) {
      for (const locale of CONSUMER_LOCALES) {
        assert.ok(localise(text, locale).length > 20, JSON.stringify({ locale, text: text.en }));
      }
    }
  });
});
