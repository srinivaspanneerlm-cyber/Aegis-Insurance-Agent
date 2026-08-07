/**
 * Lexical search, named lexical everywhere it appears.
 *
 * Scoring is BM25-shaped: term frequency with saturation, inverse document
 * frequency, and a field weight so a title match outranks a body match. It is
 * not semantic and does not pretend to be — a query for "cashless treatment"
 * will not surface an article titled "network hospitals" unless the words are
 * there.
 *
 * That limitation is reported in the result rather than left to be discovered.
 * An advisor who believes search is semantic stops after the first empty page,
 * and for a regulation lookup that is how somebody gives advice the platform
 * could have corrected. So an empty result says *why* it is empty and suggests
 * what to try.
 */
import { searchIndexRepository, knowledgeRepository } from "./repository";
import type { Actor, SearchHit, SearchQuery, SearchResult, SearchService } from "./contracts";

/**
 * Words carrying no retrieval signal.
 *
 * Short and English-only on purpose. An aggressive stop-word list is how a
 * search for "cover for a car" loses "cover" — and this platform's users write
 * in English, Tamil and Thanglish, so a long list tuned for one of those would
 * quietly degrade the other two.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "in", "on", "at", "by", "for", "with", "and", "or", "but",
  "if", "then", "than", "that", "this", "these", "those", "it", "its",
  "do", "does", "did", "can", "could", "will", "would", "should",
  "i", "you", "he", "she", "we", "they", "my", "your",
]);

/**
 * Crude suffix stripping so "policies" finds "policy".
 *
 * Not a real stemmer, and the naming says so. A full Porter stemmer would be
 * more accurate and would also need a test suite of its own; this handles the
 * plural and gerund cases that actually come up in insurance vocabulary.
 */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  return w;
}

/** Splits text into indexable terms. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    // Keeps digits and hyphens: "IRDAI/HLT/2023-24" is one meaningful token
    // family, and splitting on every non-letter would destroy circular numbers.
    .split(/[^a-z0-9\-/]+/)
    .flatMap((raw) => (raw.includes("/") ? [raw, ...raw.split("/")] : [raw]))
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

/** Field weights. A title match is a much stronger signal than a body match. */
const FIELD_WEIGHT: Record<string, number> = {
  title: 5,
  tag: 3,
  summary: 2,
  body: 1,
};

export interface IndexEntry {
  term: string;
  field: string;
  frequency: number;
}

/**
 * Turns an article into index entries.
 *
 * Exported so the indexing path and the tests use the same function — an
 * indexer that disagrees with its test is an indexer nobody can trust.
 */
export function buildIndexEntries(article: {
  title: string;
  summary: string;
  body: string;
  tags?: string | null;
}): IndexEntry[] {
  const byKey = new Map<string, IndexEntry>();

  const add = (text: string, field: string) => {
    for (const term of tokenise(text)) {
      const key = `${term}:${field}`;
      const existing = byKey.get(key);
      if (existing) existing.frequency += 1;
      else byKey.set(key, { term, field, frequency: 1 });
    }
  };

  add(article.title, "title");
  add(article.summary, "summary");
  // Bounded: a 200-page manual pasted into one article must not produce a
  // hundred thousand index rows. The first stretch is where the topic is
  // established anyway.
  add(article.body.slice(0, 20_000), "body");
  if (article.tags) add(article.tags.replace(/,/g, " "), "tag");

  return [...byKey.values()];
}

/** Saturating term frequency — BM25's k1 term, with b folded out. */
const saturate = (frequency: number): number => (frequency * 2.2) / (frequency + 1.2);

export class LexicalSearchService implements SearchService {
  async search(actor: Actor, query: SearchQuery): Promise<SearchResult> {
    const started = Date.now();
    const take = Math.min(Math.max(query.take ?? 10, 1), 50);
    const terms = [...new Set(tokenise(query.text ?? ""))];

    if (terms.length === 0) {
      return {
        hits: [],
        method: "LEXICAL",
        note: "There were no searchable words in that query — try naming the product, the rule, or the circular number.",
        took: Date.now() - started,
      };
    }

    const [entries, documentFrequency, totalDocs] = await Promise.all([
      searchIndexRepository.lookup(terms),
      searchIndexRepository.documentFrequency(terms),
      searchIndexRepository.totalIndexed(),
    ]);

    if (entries.length === 0) {
      return {
        hits: [],
        method: "LEXICAL",
        note: `Nothing matched "${terms.join(", ")}". This search matches words, not meaning — an article about the same subject in different words will not be found. Try the exact term used in the policy or circular.`,
        took: Date.now() - started,
      };
    }

    // Score per article.
    const scores = new Map<string, { score: number; matched: Set<string> }>();
    for (const entry of entries) {
      const df = documentFrequency.get(entry.term) ?? 1;
      // Inverse document frequency: a term in every article says nothing about
      // which article is relevant.
      //
      // Floored at a small positive number rather than at zero.
      //
      // Zero was the obvious floor and it is wrong twice over. A negative IDF —
      // which arises when a term appears in more documents than the index
      // believes exist — inverts the ranking, so matching more of the query
      // pushes an article *down*. And a flat zero makes every hit score
      // identically when the query is made of very common words, which leaves
      // the order to whatever the map happens to yield: ten arbitrary articles
      // presented as the ten best.
      //
      // A small positive floor keeps field weight and query coverage
      // discriminating in that case, so a title match still beats a passing
      // mention even when the word itself carries no information.
      const idf = Math.max(0.05, Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5)));
      const weight = FIELD_WEIGHT[entry.field] ?? 1;
      const contribution = saturate(entry.frequency) * idf * weight;

      const current = scores.get(entry.entityId) ?? { score: 0, matched: new Set<string>() };
      current.score += contribution;
      current.matched.add(entry.term);
      scores.set(entry.entityId, current);
    }

    // Articles matching more of the query rank above articles matching one term
    // many times — "motor claim documents" should prefer an article about all
    // three over one that says "motor" eleven times.
    for (const [id, value] of scores) {
      const coverage = value.matched.size / terms.length;
      scores.set(id, { ...value, score: value.score * (0.5 + coverage) });
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, take * 3);

    // Visibility is re-checked against the articles themselves. The index does
    // not carry classification or status, and it must not be the thing that
    // decides who sees what — an index rebuilt slightly late would otherwise
    // serve an archived article.
    const articles = await knowledgeRepository.findVisibleByIds(
      actor,
      ranked.map(([id]) => id),
      { includeUnapproved: query.includeUnapproved ?? false }
    );

    const byId = new Map(articles.map((a) => [a.id, a]));

    const hits: SearchHit[] = [];
    for (const [id, value] of ranked) {
      const article = byId.get(id);
      if (!article) continue;
      if (query.category && article.category !== query.category) continue;

      hits.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        category: article.category,
        summary: article.summary,
        score: Number(value.score.toFixed(3)),
        excerpt: excerptFor(article.body, value.matched),
        matchedTerms: [...value.matched],
        sourceRef: article.sourceRef,
        effectiveFrom: article.effectiveFrom,
        effectiveTo: article.effectiveTo,
      });
      if (hits.length >= take) break;
    }

    return {
      hits,
      method: "LEXICAL",
      note:
        hits.length === 0
          ? "Matches were found but none you have permission to read."
          : null,
      took: Date.now() - started,
    };
  }
}

/**
 * The sentence a match was found in.
 *
 * Shown so a reader can judge relevance without opening the article. A result
 * list of titles alone makes somebody open four articles to find the one that
 * answers them.
 */
function excerptFor(body: string, matched: Set<string>): string | null {
  const sentences = body.split(/(?<=[.?!])\s+/);
  for (const sentence of sentences) {
    const tokens = new Set(tokenise(sentence));
    for (const term of matched) {
      if (tokens.has(term)) {
        const trimmed = sentence.trim();
        return trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed;
      }
    }
  }
  return null;
}

let searchImpl: SearchService = new LexicalSearchService();

export const searchService = (): SearchService => searchImpl;

/** Swapped when a hybrid or semantic implementation arrives. */
export function registerSearchService(service: SearchService): void {
  searchImpl = service;
}

export function resetSearchService(): void {
  searchImpl = new LexicalSearchService();
}
