/**
 * The Knowledge & Memory Platform, as interfaces.
 *
 * Two of these — `EmbeddingService` and `VectorStoreInterface` — are declared
 * and deliberately not implemented, because this deployment has no embedding
 * model and no vector database. What it has instead is lexical search, which is
 * named lexical everywhere it appears rather than dressed up as semantic.
 *
 * That naming is not pedantry. An advisor told a search is "semantic" assumes a
 * query about "cashless treatment" will surface an article titled "network
 * hospitals". Lexical search will not, and an advisor who believes otherwise
 * stops looking after the first empty result — which for a regulation search is
 * how somebody ends up giving advice the platform could have corrected.
 */

// ── Knowledge ────────────────────────────────────────────────────────────────

export const KNOWLEDGE_CATEGORIES = [
  "REGULATION",
  "PRODUCT",
  "POLICY_RULE",
  "CLAIMS_SOP",
  "RENEWAL",
  "COMPANY_POLICY",
  "FAQ",
  "TRAINING",
  "COMPLIANCE",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const isKnowledgeCategory = (v: unknown): v is KnowledgeCategory =>
  typeof v === "string" && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(v);

export const KNOWLEDGE_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "RESTRICTED"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export interface Actor {
  readonly id: string;
  readonly role: string;
  readonly realm?: string;
}

export interface ArticleInput {
  readonly slug?: string;
  readonly title: string;
  readonly category: KnowledgeCategory;
  readonly summary: string;
  readonly body: string;
  readonly tags?: readonly string[];
  readonly departments?: readonly string[];
  readonly classification?: Classification;
  readonly sourceRef?: string;
  readonly sourceKind?: string;
  readonly effectiveFrom?: Date;
  readonly effectiveTo?: Date;
  readonly reviewDueAt?: Date;
  /** Why this changed. Recorded on the version, not the article. */
  readonly changeNote?: string;
}

export interface KnowledgeService {
  create(actor: Actor, input: ArticleInput): Promise<unknown>;
  update(actor: Actor, id: string, input: Partial<ArticleInput>): Promise<unknown>;
  submitForReview(actor: Actor, id: string): Promise<unknown>;
  review(
    actor: Actor,
    id: string,
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
    notes?: string
  ): Promise<unknown>;
  archive(actor: Actor, id: string, reason: string): Promise<unknown>;
  get(actor: Actor, idOrSlug: string): Promise<unknown>;
  history(actor: Actor, id: string): Promise<unknown>;
  analytics(actor: Actor): Promise<unknown>;
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchQuery {
  readonly text: string;
  readonly category?: KnowledgeCategory;
  readonly take?: number;
  /** Include articles that are not APPROVED. Requires knowledge.write. */
  readonly includeUnapproved?: boolean;
}

export interface SearchHit {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly score: number;
  /** The sentence the match was found in, so a reader can judge relevance. */
  readonly excerpt: string | null;
  readonly matchedTerms: readonly string[];
  readonly sourceRef: string | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
}

export interface SearchResult {
  readonly hits: readonly SearchHit[];
  /** LEXICAL | SEMANTIC | HYBRID — stated, never assumed. */
  readonly method: "LEXICAL" | "SEMANTIC" | "HYBRID";
  /** Said plainly when a query returns nothing, so a reader knows why. */
  readonly note: string | null;
  readonly took: number;
}

export interface SearchService {
  search(actor: Actor, query: SearchQuery): Promise<SearchResult>;
}

/**
 * Turning text into vectors. Not implemented here.
 *
 * Declared so the day an embedding model exists, `SearchService` gains a hybrid
 * path without anything upstream changing. There is deliberately no stub that
 * returns random vectors — a search that ranks by noise is worse than one that
 * admits it is lexical.
 */
export interface EmbeddingService {
  readonly available: boolean;
  readonly model?: string;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

/** Where those vectors would live. Also not implemented. */
export interface VectorStoreInterface {
  readonly available: boolean;
  upsert(records: ReadonlyArray<{ id: string; vector: readonly number[]; metadata?: unknown }>): Promise<void>;
  query(
    vector: readonly number[],
    options?: { readonly take?: number; readonly filter?: Record<string, unknown> }
  ): Promise<ReadonlyArray<{ id: string; score: number }>>;
  remove(ids: readonly string[]): Promise<void>;
}

/**
 * Reading an uploaded file into text a knowledge article can be built from.
 *
 * Separate from the Sprint 8 document pipeline on purpose. That pipeline
 * decides whether a *customer's* document is genuine; this one extracts text
 * from an *internal* file so somebody can turn a circular into guidance. Same
 * shape of problem, entirely different trust model — a customer's upload is
 * untrusted input, a compliance officer's circular is not.
 */
export interface DocumentParserInterface {
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly supports: readonly string[];
  parse(input: {
    readonly filename: string;
    readonly mimeType: string | null;
    readonly bytes?: Uint8Array;
    readonly text?: string;
  }): Promise<{
    readonly ok: boolean;
    readonly text: string | null;
    readonly title: string | null;
    /** Suggested sections, so a long circular can become several articles. */
    readonly sections: ReadonlyArray<{ heading: string; body: string }>;
    readonly reason?: string;
  }>;
}

// ── Memory ───────────────────────────────────────────────────────────────────

export const MEMORY_SCOPES = ["CUSTOMER", "EMPLOYEE", "ORGANIZATION", "PLATFORM"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_KINDS = [
  "PREFERENCE",
  "FACT",
  "CONTEXT",
  "HISTORY",
  "CONSENT",
  "CONSTRAINT",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_SOURCES = [
  "CUSTOMER_STATED",
  "ADVISOR_ENTERED",
  "AI_INFERRED",
  "DOCUMENT",
  "SYSTEM",
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface MemoryAssertion {
  readonly scope: MemoryScope;
  readonly subjectId: string;
  readonly kind: MemoryKind;
  readonly key: string;
  readonly value: unknown;
  readonly confidence?: number;
  readonly source?: MemorySource;
  readonly sourceRef?: string;
  readonly expiresAt?: Date;
}

export interface MemoryFact {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly key: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly source: MemorySource;
  readonly sourceRef: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}

/**
 * Institutional memory.
 *
 * Every read is scoped by the caller's permissions and every write records
 * where the fact came from. A fact with no provenance cannot be challenged by
 * the person it is about, and a platform that advises people on insurance has
 * to be able to answer "why do you think that about me?".
 */
export interface MemoryService {
  remember(actor: Actor, assertion: MemoryAssertion): Promise<MemoryFact>;
  recall(
    actor: Actor,
    scope: MemoryScope,
    subjectId: string,
    options?: { readonly kind?: MemoryKind; readonly prefix?: string }
  ): Promise<readonly MemoryFact[]>;
  forget(actor: Actor, scope: MemoryScope, subjectId: string, key: string): Promise<{ forgotten: number }>;
  /** Every value a key has held, newest first. */
  keyHistory(actor: Actor, scope: MemoryScope, subjectId: string, key: string): Promise<unknown>;
  /** Everything known about somebody, for a subject-access request. */
  export(actor: Actor, scope: MemoryScope, subjectId: string): Promise<unknown>;
}

// ── The router ───────────────────────────────────────────────────────────────

export const KNOWLEDGE_SOURCES = [
  "KNOWLEDGE_BASE",
  "MEMORY",
  "DOCUMENTS",
  "INTELLIGENCE",
  "NONE",
] as const;
export type KnowledgeSourceName = (typeof KNOWLEDGE_SOURCES)[number];

export interface RoutingDecision {
  readonly source: KnowledgeSourceName;
  /** Why this source, in words. The router explains itself like everything else. */
  readonly why: string;
  readonly confidence: number;
  /** Other sources worth trying, in order. */
  readonly alternates: readonly KnowledgeSourceName[];
}

/**
 * Decides which store answers a question.
 *
 * Rule-driven and readable rather than a classifier. Routing errors are silent
 * — a question sent to the wrong store returns nothing rather than an error,
 * and nobody discovers the rule was wrong. A rule an engineer can read and a
 * test can pin is worth more here than a few points of accuracy.
 */
export interface KnowledgeRouter {
  route(question: string, context?: { readonly hasCustomer?: boolean }): RoutingDecision;
}
