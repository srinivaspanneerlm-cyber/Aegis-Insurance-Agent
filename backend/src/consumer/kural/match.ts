/**
 * Choosing which of the six questions somebody asked.
 *
 * Deterministic scoring over a fixed keyword table — no model, no embedding, no
 * network call. Three consequences follow, and all three are the reason it is
 * built this way:
 *
 *   • The same question always gets the same answer. A customer who asks twice,
 *     or two customers who ask alike, cannot be told different things.
 *   • It can say **no**. A matcher that always returns its best guess will
 *     answer "does this cover flood damage?" with the no-claim-bonus entry, and
 *     confidently. Below the threshold this returns nothing, and the service
 *     hands the person to a human — which is the correct answer to a question
 *     outside six topics.
 *   • Every rule is a unit test rather than an evaluation run.
 *
 * It is not clever and does not need to be. Six topics with distinctive
 * vocabulary is a problem that keyword matching solves completely, and the
 * failure mode of something cleverer — a plausible answer to a question nobody
 * asked — is the one failure this product cannot afford.
 */
import { KURAL_ENTRIES, type KuralEntry, type KuralTopic } from "./topics";

/** The longest question we will look at. Anything beyond this is not a question. */
export const MAX_QUESTION_LENGTH = 500;

export interface Match {
  readonly topic: KuralTopic;
  /** Whole points, not a probability — see `SCORES`. Higher is a better match. */
  readonly score: number;
  /** Which words earned it, so a support conversation can be specific. */
  readonly matched: readonly string[];
}

/**
 * What a hit is worth.
 *
 * A strong keyword alone is enough. Two ordinary words are too, because "when
 * does my cover end" carries no single decisive term. One ordinary word is not:
 * "cover" appears in questions about every topic here and half the ones that are
 * not, and answering on it alone is how a matcher becomes confidently wrong.
 */
const SCORES = { strong: 2, ordinary: 1 } as const;
export const MATCH_THRESHOLD = 2;

/**
 * A question, flattened to something matchable.
 *
 * Punctuation becomes spaces rather than disappearing, so "third-party" and
 * "third party" normalise alike while "idvalue" never matches "idv". The spaces
 * at either end let a keyword be tested as a whole word by searching for it
 * padded, which is what stops "ncb" matching inside a longer word.
 *
 * Combining marks are kept (`\p{M}`), and that is not a detail. Tamil writes its
 * vowels as marks attached to a consonant, so stripping them does not tidy a
 * word — it shatters it into unreadable single letters, and every Tamil question
 * silently stops matching. The language this product exists to serve would have
 * been the one language the assistant could not read.
 */
export function normalise(question: string): string {
  return ` ${question.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim()} `;
}

/**
 * The same question with dotted acronyms put back together.
 *
 * "I.D.V." normalises to "i d v", which matches nothing. Runs of two or more
 * single-character tokens are joined, which recovers the acronym without
 * reintroducing substring matching — "ncb" still cannot match inside
 * "syncbase", because nothing here removes the word boundaries that stop it.
 */
export function joinAcronyms(normalised: string): string {
  // A run of two or more letters each followed by a space — "i d v " — with the
  // spaces taken out and one put back, so the word boundary survives.
  return normalised.replace(/(?<= )(?:\p{L} ){2,}/gu, (run) => `${run.replace(/ /g, "")} `);
}

/** Whether a keyword appears as a whole word (or phrase) in a normalised question. */
export function containsTerm(normalised: string, term: string): boolean {
  const needle = ` ${term.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim()} `;
  return normalised.includes(needle);
}

function scoreEntry(normalised: string, entry: KuralEntry): Match {
  const matched: string[] = [];
  let score = 0;

  // Both readings of the question: as written, and with dotted acronyms rejoined.
  const forms = [normalised, joinAcronyms(normalised)];
  const present = (keyword: string) => forms.some((form) => containsTerm(form, keyword));

  const strong = new Set(entry.strongKeywords ?? []);
  for (const keyword of entry.keywords) {
    if (!present(keyword)) continue;
    matched.push(keyword);
    score += strong.has(keyword) ? SCORES.strong : SCORES.ordinary;
  }
  // A strong keyword listed only in `strongKeywords` still counts.
  for (const keyword of entry.strongKeywords ?? []) {
    if (entry.keywords.includes(keyword)) continue;
    if (!present(keyword)) continue;
    matched.push(keyword);
    score += SCORES.strong;
  }

  return { topic: entry.id, score, matched };
}

/**
 * The best topic for a question, or null when nothing is close enough.
 *
 * Ties are broken by the longest matched keyword rather than by the order of
 * the catalogue: "zero depreciation" beating "depreciation" is a better answer
 * than whichever entry happens to be listed first, and a tie decided by array
 * position is one that changes when somebody reorders the file.
 */
export function matchQuestion(question: string): Match | null {
  if (typeof question !== "string") return null;
  const trimmed = question.trim();
  if (trimmed === "" || trimmed.length > MAX_QUESTION_LENGTH) return null;

  const normalised = normalise(trimmed);
  if (normalised.trim() === "") return null;

  const scored = KURAL_ENTRIES.map((entry) => scoreEntry(normalised, entry))
    .filter((match) => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const longest = (m: Match) => Math.max(0, ...m.matched.map((k) => k.length));
      return longest(b) - longest(a);
    });

  return scored[0] ?? null;
}

/** Every topic a question touches, best first. Used to offer "did you mean". */
export function relatedTopics(question: string, limit = 2): readonly KuralTopic[] {
  const normalised = normalise(question ?? "");
  return KURAL_ENTRIES.map((entry) => scoreEntry(normalised, entry))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.topic);
}
