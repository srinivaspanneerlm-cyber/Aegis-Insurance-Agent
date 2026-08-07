/**
 * The knowledge and memory vocabulary, as the portals consume it.
 *
 * Mirrors `backend/src/knowledge/contracts.ts` rather than importing it — the
 * backend is not in this workspace and a browser bundle must not depend on a
 * server module. The duplication is narrow and deliberate: these are the fields
 * that cross the wire, and a mismatch shows up as a type error in the portal
 * that reads them.
 */

export const KNOWLEDGE_TYPES = [
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
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export type KnowledgeStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
export type Classification = "PUBLIC" | "INTERNAL" | "RESTRICTED";
export type Tone = "danger" | "warning" | "info" | "neutral" | "success";

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body?: string;
  status: KnowledgeStatus;
  classification: Classification;
  version: number;
  tags: string | null;
  sourceRef: string | null;
  sourceKind?: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  reviewDueAt: string | null;
  publishedAt: string;
  updatedAt: string;
  viewCount: number;
  categoryId?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
}

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  score: number;
  excerpt: string | null;
  matchedTerms: string[];
  sourceRef: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface SearchResult {
  hits: SearchHit[];
  method: "LEXICAL" | "SEMANTIC" | "HYBRID";
  note: string | null;
  took: number;
}

export interface KnowledgeVersion {
  id: string;
  version: number;
  title: string;
  summary: string;
  changeNote: string | null;
  authoredById: string | null;
  createdAt: string;
}

export interface KnowledgeReview {
  id: string;
  decision: string;
  reviewerId: string;
  notes: string | null;
  createdAt: string;
}

export interface KnowledgeHistory {
  articleId: string;
  currentVersion: number;
  versions: KnowledgeVersion[];
  reviews: KnowledgeReview[];
}

export interface KnowledgeCategory {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  position: number;
}

export interface KnowledgeTag {
  slug: string;
  name: string;
  usageCount: number;
}

// ── Memory ───────────────────────────────────────────────────────────────────

export type MemoryScope = "CUSTOMER" | "EMPLOYEE" | "ORGANIZATION" | "PLATFORM";
export type MemoryKind = "PREFERENCE" | "FACT" | "CONTEXT" | "HISTORY" | "CONSENT" | "CONSTRAINT";
export type MemorySource =
  "CUSTOMER_STATED" | "ADVISOR_ENTERED" | "AI_INFERRED" | "DOCUMENT" | "SYSTEM";

export interface MemoryFact {
  id: string;
  kind: MemoryKind;
  key: string;
  value: unknown;
  confidence: number;
  source: MemorySource;
  sourceRef: string | null;
  createdAt: string;
  expiresAt: string | null;
  supersededAt?: string | null;
  current?: boolean;
}

export interface ConversationMemoryEntry {
  id: string;
  kind: string;
  label: string;
  value: unknown;
  pinned: boolean;
  retention: string;
  promotedRecordId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface RoutingDecision {
  source: "KNOWLEDGE_BASE" | "MEMORY" | "DOCUMENTS" | "INTELLIGENCE" | "NONE";
  why: string;
  confidence: number;
  alternates: string[];
}

// ── Presentation ─────────────────────────────────────────────────────────────

/**
 * How each status is said to a person.
 *
 * "IN_REVIEW" is a database value; "Waiting for a reviewer" is what somebody
 * reads. The tone matters too — a draft is not an error, so it is neutral
 * rather than red.
 */
export const STATUS_META: Record<KnowledgeStatus, { label: string; tone: Tone; hint: string }> = {
  DRAFT: {
    label: "Draft",
    tone: "neutral",
    hint: "Not published. Only people who can edit knowledge see this.",
  },
  IN_REVIEW: {
    label: "Waiting for a reviewer",
    tone: "info",
    hint: "Somebody other than the author has to approve it.",
  },
  APPROVED: {
    label: "Published",
    tone: "success",
    hint: "Live, and answering questions across the platform.",
  },
  ARCHIVED: {
    label: "Withdrawn",
    tone: "warning",
    hint: "No longer served. Kept so past advice can still be explained.",
  },
};

export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; tone: Tone; hint: string }
> = {
  PUBLIC: { label: "Public", tone: "success", hint: "Customers can read this." },
  INTERNAL: { label: "Internal", tone: "info", hint: "Staff only." },
  RESTRICTED: {
    label: "Restricted",
    tone: "danger",
    hint: "Needs a named grant. Not visible to staff without one.",
  },
};

export const TYPE_LABEL: Record<string, string> = {
  REGULATION: "Regulation",
  PRODUCT: "Product",
  POLICY_RULE: "Policy rule",
  CLAIMS_SOP: "Claims procedure",
  RENEWAL: "Renewal",
  COMPANY_POLICY: "Company policy",
  FAQ: "Frequently asked",
  TRAINING: "Training",
  COMPLIANCE: "Compliance",
  // The legacy vocabulary the pre-Sprint-11 articles were filed under. Shown
  // rather than left as a raw enum, because those articles are still live.
  POLICY: "Policy",
  SOP: "Procedure",
  CIRCULAR: "Circular",
  GUIDELINE: "Guideline",
};

export const MEMORY_SOURCE_META: Record<MemorySource, { label: string; tone: Tone; hint: string }> =
  {
    CUSTOMER_STATED: {
      label: "They told us",
      tone: "success",
      hint: "Stated by the customer themselves.",
    },
    ADVISOR_ENTERED: {
      label: "An advisor recorded",
      tone: "info",
      hint: "Entered by a member of staff.",
    },
    AI_INFERRED: {
      label: "Aegis inferred",
      tone: "warning",
      hint: "Worked out by the platform, not confirmed by anyone.",
    },
    DOCUMENT: { label: "From a document", tone: "info", hint: "Read from something uploaded." },
    SYSTEM: { label: "Recorded automatically", tone: "neutral", hint: "Written by the platform." },
  };

export const TONE_BORDER: Record<Tone, string> = {
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
  info: "border-info/40 text-info",
  success: "border-success/40 text-success",
  neutral: "border-line/60 text-content-muted",
};

/** Confidence in words, with the number alongside. */
export function confidenceLabel(score: number): string {
  if (score >= 0.9) return "Confirmed";
  if (score >= 0.7) return "Likely";
  if (score >= 0.4) return "Uncertain";
  return "A guess";
}

/** "3 minutes ago", falling back to a date past a week. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 7200) return "an hour ago";
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "yesterday";
  if (seconds < 604800) return `${Math.round(seconds / 86400)} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Splits the comma-separated tag column the backend still stores. */
export function tagsOf(article: { tags: string | null }): string[] {
  return (article.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Whether guidance is currently in force.
 *
 * Shown on the card rather than only on the detail page: an advisor scanning a
 * list needs to see that a circular expired last month before they quote it,
 * not after.
 */
export function effectiveState(article: {
  effectiveFrom: string | null;
  effectiveTo: string | null;
}): { state: "IN_FORCE" | "NOT_YET" | "EXPIRED" | "ALWAYS"; label: string; tone: Tone } {
  const now = Date.now();
  const from = article.effectiveFrom ? new Date(article.effectiveFrom).getTime() : null;
  const to = article.effectiveTo ? new Date(article.effectiveTo).getTime() : null;

  if (from !== null && from > now) {
    return {
      state: "NOT_YET",
      label: `In force from ${timeAgo(article.effectiveFrom)}`,
      tone: "info",
    };
  }
  if (to !== null && to <= now) {
    return { state: "EXPIRED", label: "No longer in force", tone: "warning" };
  }
  if (to !== null) {
    return {
      state: "IN_FORCE",
      label: `In force until ${new Date(to).toLocaleDateString()}`,
      tone: "success",
    };
  }
  return { state: "ALWAYS", label: "In force", tone: "neutral" };
}
