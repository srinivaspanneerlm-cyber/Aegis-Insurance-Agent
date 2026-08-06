/**
 * The document pipeline, as interfaces.
 *
 * Every stage a document passes through is declared here and implemented
 * nowhere vendor-specific. That is the point: virus scanning, OCR, fraud
 * scoring and notarisation are all things this platform will eventually buy
 * rather than build, and the decision about *which* vendor should not be
 * embedded in the code that moves a document through a queue.
 *
 * Each interface is written from the caller's side — what the pipeline needs to
 * know — rather than from any product's API shape. A stage returns a verdict
 * and its reasoning; how it arrived there is entirely its own business.
 *
 * The simulated implementations below are deliberately obvious about being
 * simulations. A stub that returns plausible-looking OCR text would eventually
 * be mistaken for real extraction, and somebody would make a decision on it.
 */

export interface DocumentRef {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly contentHash: string | null;
  /** Where the bytes are. Never sent to a client. */
  readonly filepath: string;
}

/** Every stage answers with one of these, so the pipeline can be uniform. */
export interface StageResult<T = unknown> {
  readonly ok: boolean;
  /** Whether this stage actually ran, or reported itself unavailable. */
  readonly simulated: boolean;
  readonly summary: string;
  readonly data: T | null;
}

// ── Virus scanning ───────────────────────────────────────────────────────────

export interface VirusScanResult {
  readonly clean: boolean;
  readonly signature: string | null;
}

/**
 * The one stage that must fail closed.
 *
 * A document that could not be scanned is not a clean document — it is an
 * unknown one, and treating unknown as clean is how malware reaches a claims
 * handler's desktop.
 */
export interface VirusScanService {
  scan(document: DocumentRef): Promise<StageResult<VirusScanResult>>;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrResult {
  readonly text: string;
  /** 0–1. How much the engine trusts its own reading. */
  readonly confidence: number;
  readonly pageCount: number | null;
  readonly language: string | null;
}

export interface OcrService {
  /** Returns `ok: false` for formats it cannot read rather than empty text. */
  extractText(document: DocumentRef): Promise<StageResult<OcrResult>>;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export interface MetadataResult {
  /** Structured fields pulled from the document, keyed by field name. */
  readonly fields: Record<string, string>;
  /** Which fields the extractor expected and did not find. */
  readonly missing: readonly string[];
  readonly capturedAt: string | null;
}

export interface MetadataService {
  /**
   * `documentKey` tells the extractor what it is looking at, so it can look for
   * the right fields. A generic extractor that guesses produces a bag of
   * strings nobody can act on.
   */
  extract(document: DocumentRef, documentKey: string | null): Promise<StageResult<MetadataResult>>;
}

// ── Fraud ────────────────────────────────────────────────────────────────────

export interface FraudResult {
  /** 0–1, higher is more concerning. */
  readonly score: number;
  readonly signals: readonly string[];
  /** Why, in words. A score with no explanation cannot be acted on or appealed. */
  readonly reasoning: string;
}

/**
 * Scores, never decides.
 *
 * The result of this stage moves a document to PENDING_REVIEW at most. A
 * document is only ever rejected by a person, for the same reason a claim is:
 * somebody has to be answerable, and a customer refused by a score with no
 * appeal is a complaint the platform deserves.
 */
export interface FraudService {
  assess(
    document: DocumentRef,
    context: { readonly ocr: OcrResult | null; readonly metadata: MetadataResult | null }
  ): Promise<StageResult<FraudResult>>;
}

// ── Location ─────────────────────────────────────────────────────────────────

export interface GeoResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number | null;
  readonly capturedAt: string | null;
}

/**
 * Where a photograph was taken, from its own EXIF.
 *
 * Never from the uploader's browser. A device location asked for at upload time
 * says where the *upload* happened, which is not the same claim and would be
 * quietly misleading on a damage photograph taken a week earlier.
 */
export interface GeoService {
  locate(document: DocumentRef): Promise<StageResult<GeoResult>>;
}

// ── Integrity ────────────────────────────────────────────────────────────────

export interface IntegrityAnchor {
  readonly algorithm: string;
  readonly digest: string;
  /** Where it was anchored, once anchoring exists. */
  readonly anchoredTo: string | null;
  readonly anchoredAt: string | null;
}

/**
 * Proof that a document has not changed since it was accepted.
 *
 * Named for what it does rather than for a technology. Calling this
 * `BlockchainHashService` would fix a decision that has not been made — a
 * signed timestamp from a trusted authority answers the same question, and is
 * what most regulators actually accept.
 */
export interface IntegrityService {
  anchor(document: DocumentRef): Promise<StageResult<IntegrityAnchor>>;
  verify(document: DocumentRef, anchor: IntegrityAnchor): Promise<StageResult<{ intact: boolean }>>;
}

// ── The pipeline ─────────────────────────────────────────────────────────────

export interface DocumentPipeline {
  readonly virusScan: VirusScanService;
  readonly ocr: OcrService;
  readonly metadata: MetadataService;
  readonly fraud: FraudService;
  readonly geo: GeoService;
  readonly integrity: IntegrityService;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulated implementations.
//
// Every one reports `simulated: true` and says so in its summary, which travels
// all the way to the document's timeline. Somebody reading a document's history
// sees "OCR did not run — no engine is configured", not an empty text field
// they might mistake for a document with no text in it.
// ─────────────────────────────────────────────────────────────────────────────

const unavailable = <T>(stage: string, why: string): StageResult<T> => ({
  ok: false,
  simulated: true,
  summary: `${stage} did not run — ${why}.`,
  data: null,
});

export const simulatedPipeline: DocumentPipeline = {
  virusScan: {
    async scan(document) {
      // Fails *open* only because there is no scanner at all, and says so
      // loudly in the document's own timeline. This is safe to leave in place
      // only in development: `uploadsPermitted()` below refuses to run the
      // pipeline at all in production while this is still the registered
      // scanner, so the comment is backed by a control rather than by hope.
      return {
        ok: true,
        simulated: true,
        summary: `Not scanned — no virus scanner is configured. ${document.filename} was accepted unscanned.`,
        data: { clean: true, signature: null },
      };
    },
  },

  ocr: {
    async extractText() {
      return unavailable("Text extraction", "no OCR engine is configured");
    },
  },

  metadata: {
    async extract(_document, documentKey) {
      return unavailable(
        "Field extraction",
        documentKey
          ? `no extractor is configured for "${documentKey}"`
          : "no extractor is configured"
      );
    },
  },

  fraud: {
    async assess() {
      return unavailable("Risk analysis", "no fraud service is configured");
    },
  },

  geo: {
    async locate() {
      return unavailable("Location", "EXIF reading is not implemented");
    },
  },

  integrity: {
    async anchor() {
      return unavailable("Integrity anchoring", "no anchoring service is configured");
    },
    async verify() {
      return unavailable("Integrity check", "no anchoring service is configured");
    },
  },
};

/**
 * The pipeline the application uses.
 *
 * A single indirection so a deployment can swap implementations in one place.
 * When a real scanner arrives it is registered here and nothing else changes.
 */
let active: DocumentPipeline = simulatedPipeline;

/**
 * Which stages are still the simulation.
 *
 * Tracked rather than inferred, because a real implementation is recognised by
 * having been registered — not by anything observable about the object.
 */
const stageKeys = () => Object.keys(simulatedPipeline) as (keyof DocumentPipeline)[];
const simulatedStages = new Set<keyof DocumentPipeline>(stageKeys());

export const documentPipeline = (): DocumentPipeline => active;

export function registerPipeline(pipeline: Partial<DocumentPipeline>): void {
  active = { ...active, ...pipeline };
  for (const key of Object.keys(pipeline) as (keyof DocumentPipeline)[]) {
    simulatedStages.delete(key);
  }
}

/** Restores the simulated pipeline. Used by tests to undo a registration. */
export function resetPipeline(): void {
  active = simulatedPipeline;
  for (const key of stageKeys()) simulatedStages.add(key);
}

/**
 * Whether this deployment may accept uploads at all.
 *
 * The simulated scanner returns "clean" for everything. That is the right
 * behaviour in development — otherwise nobody could work on the pipeline
 * without standing up ClamAV — and an unacceptable one in production, where it
 * means accepting executables from the public internet and telling a human
 * reviewer they were scanned.
 *
 * A comment asking a deployer to remember is not a control, so this is a
 * control: in production, no registered scanner means no uploads. Every other
 * stage may stay simulated, since a missing OCR engine costs convenience while
 * a missing scanner costs safety.
 */
export function uploadsPermitted(): { ok: true } | { ok: false; reason: string } {
  if (process.env.NODE_ENV !== "production") return { ok: true };
  if (!simulatedStages.has("virusScan")) return { ok: true };
  return {
    ok: false,
    reason:
      "Document uploads are disabled: no virus scanner is configured. " +
      "Register a VirusScanService with registerPipeline() before enabling uploads in production.",
  };
}
