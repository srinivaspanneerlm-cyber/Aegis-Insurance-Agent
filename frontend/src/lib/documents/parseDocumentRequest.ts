import { extractTaggedPayload } from "@/lib/tagParser";
import type {
  DocumentRequest,
  DocumentRequirement,
  LocalisedText,
  VerificationStageId,
} from "@/types/documents";
import { matchKinds, requirementFromKind, requirementsForDomain } from "./registry";

/**
 * Turning an agent's reply into upload cards.
 *
 * Two routes, in priority order:
 *
 *  1. **`[DOCUMENT_REQUEST:{…}]`** — the structured tag, mirroring the existing
 *     `[RECOMMENDATION:{…}]` convention. Authoritative: whatever the agent asks
 *     for is what renders, catalogue or not.
 *  2. **Prose inference** — the agent asked for documents in plain language.
 *     Catalogue aliases resolve the named documents; if it asked for
 *     "documents" without naming any, the domain's default set is used.
 *
 * Route 2 exists so the workflow works against today's agents, unchanged. Route
 * 1 is how an agent takes full control once it emits the tag.
 */

// ── Tag payload (what an agent emits) ────────────────────────────────────────

interface RawRequirement {
  kind?: string;
  id?: string;
  label?: string | LocalisedText;
  hint?: string | LocalisedText;
  icon?: string;
  accept?: string[];
  max_bytes?: number;
  maxBytes?: number;
  multiple?: boolean;
  required?: boolean;
  stages?: VerificationStageId[];
}

interface RawRequest {
  title?: string | LocalisedText;
  note?: string | LocalisedText;
  /** Both spellings accepted — agents are prompt-driven and drift. */
  documents?: RawRequirement[];
  requirements?: RawRequirement[];
  agent?: string;
  domain?: string;
}

export interface DocumentRequestContext {
  agentName?: string;
  agentDomain?: string;
  /** Stable id for this request — pass the message id so cards keep identity
   *  across re-renders. */
  requestId?: string;
}

const DEFAULT_TITLE: LocalisedText = {
  en: "Documents needed",
  ta: "தேவையான ஆவணங்கள்",
  taEn: "Documents venum",
};

function asLocalised(value: string | LocalisedText | undefined): LocalisedText | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? { en: value } : value;
}

function normaliseRequirement(raw: RawRequirement, index: number): DocumentRequirement | null {
  const kind = (raw.kind || "").trim();
  if (!kind) return null;

  const overrides: Partial<DocumentRequirement> = {
    id: raw.id || `${kind}-${index}`,
    required: raw.required ?? true,
  };
  const label = asLocalised(raw.label);
  const hint = asLocalised(raw.hint);
  if (label) overrides.label = label;
  if (hint) overrides.hint = hint;
  if (raw.icon) overrides.icon = raw.icon;
  if (raw.accept?.length) overrides.accept = raw.accept;
  if (typeof raw.multiple === "boolean") overrides.multiple = raw.multiple;
  if (raw.stages?.length) overrides.stages = raw.stages;

  const maxBytes = raw.maxBytes ?? raw.max_bytes;
  if (typeof maxBytes === "number" && maxBytes > 0) overrides.maxBytes = maxBytes;

  return requirementFromKind(kind, overrides);
}

/** Extract the structured `[DOCUMENT_REQUEST:{…}]` tag, if the agent sent one. */
export function parseDocumentRequest(
  text: string,
  ctx: DocumentRequestContext = {},
): { request: DocumentRequest; cleanedText: string } | null {
  const tagged = extractTaggedPayload<RawRequest>(text, "DOCUMENT_REQUEST");
  if (!tagged) return null;

  const raw = tagged.data;
  const rawDocs = raw.documents ?? raw.requirements ?? [];
  const requirements = rawDocs
    .map(normaliseRequirement)
    .filter((r): r is DocumentRequirement => r !== null);

  // A tag that names nothing usable is not a request — leave the prose alone
  // rather than rendering an empty card.
  if (requirements.length === 0) return null;

  return {
    request: {
      id: ctx.requestId ? `${ctx.requestId}-docs` : "document-request",
      title: asLocalised(raw.title) ?? DEFAULT_TITLE,
      note: asLocalised(raw.note),
      requirements,
      agentName: raw.agent || ctx.agentName,
      agentDomain: raw.domain || ctx.agentDomain,
      source: "ai-tag",
    },
    cleanedText: tagged.cleanedText,
  };
}

/**
 * The prose with the tag taken out, for the transcript to render.
 *
 * A `[DOCUMENT_REQUEST:{…}]` tag is an instruction to the UI, not something a
 * customer should ever read — it is stripped whether or not it produced a
 * usable request.
 */
export function stripDocumentRequestTag(text: string): string {
  return extractTaggedPayload<RawRequest>(text, "DOCUMENT_REQUEST")?.cleanedText ?? text;
}

// ── Prose inference ──────────────────────────────────────────────────────────

/** Phrases that mean "the customer has to hand something over". */
const ASK_PATTERNS: RegExp[] = [
  /\bupload\b/i,
  /\battach\b/i,
  /\bsubmit\b/i,
  /\bsend (?:me|us|across)\b/i,
  /\bshare (?:your|the|a|me)\b/i,
  /\bprovide (?:your|the|a)\b/i,
  /\b(?:i|we)(?:'ll| will)? need\b/i,
  /\b(?:is|are) required\b/i,
  /\banuppunga\b/i, // Thanglish: "send it"
  /\bkudunga\b/i, // Thanglish: "give it"
  /பதிவேற்ற/, // Tamil: "upload"
  /அனுப்ப/, // Tamil: "send"
];

/** Nouns that make a bare ask ("I need a few documents") resolvable. */
const DOCUMENT_NOUN = /\b(documents?|proofs?|papers?|copies|copy)\b|ஆவண/i;

/**
 * Derive a request from the agent's prose. Returns null unless the reply both
 * asks for something *and* either names a catalogue document or says
 * "documents" — a passing mention of the word "upload" is not a request.
 */
export function inferDocumentRequest(
  text: string,
  ctx: DocumentRequestContext = {},
): DocumentRequest | null {
  if (!ASK_PATTERNS.some((p) => p.test(text))) return null;

  const named = matchKinds(text);
  const requirements =
    named.length > 0
      ? named.map((kind, i) => requirementFromKind(kind, { id: `${kind}-${i}` }))
      : DOCUMENT_NOUN.test(text)
        ? requirementsForDomain(ctx.agentDomain || "")
        : [];

  if (requirements.length === 0) return null;

  return {
    id: ctx.requestId ? `${ctx.requestId}-docs` : "document-request",
    title: DEFAULT_TITLE,
    requirements,
    agentName: ctx.agentName,
    agentDomain: ctx.agentDomain,
    source: "inferred",
  };
}

/**
 * The single entry point the transcript uses: structured tag first, prose
 * inference second. `cleanedText` is the prose to render — identical to the
 * input unless a tag was stripped out of it.
 */
export function resolveDocumentRequest(
  text: string,
  ctx: DocumentRequestContext = {},
): { request: DocumentRequest; cleanedText: string } | null {
  const tagged = parseDocumentRequest(text, ctx);
  if (tagged) return tagged;

  const inferred = inferDocumentRequest(text, ctx);
  return inferred ? { request: inferred, cleanedText: text } : null;
}
