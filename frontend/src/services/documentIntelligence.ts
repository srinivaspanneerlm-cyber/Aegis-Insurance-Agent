import type {
  DocumentIntelligence,
  VerificationStage,
  VerificationStageId,
  VerificationStatus,
} from "@/types/documents";

/**
 * The document-intelligence seam.
 *
 * OCR, metadata, geo-verification, fraud scoring and blockchain anchoring are
 * separate services that do not exist yet. Rather than let the UI grow a
 * dependency on any of them, everything goes through one small interface with
 * three implementations — unavailable, simulated, and MCP. Connecting a real
 * service later is a factory change, not a component change.
 *
 * The default is deliberately `unavailable`: a stage that has no service behind
 * it reports `skipped`, never a green tick. A verification badge in this product
 * is a promise to the customer, so it is only ever shown when something actually
 * verified the document.
 */

// ── Contract ─────────────────────────────────────────────────────────────────

export interface DocumentAnalysisRequest {
  /** Server-side document id, once the file has been persisted. */
  documentId?: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StageOutcome {
  status: Extract<VerificationStatus, "passed" | "failed" | "skipped">;
  /** One line the customer can read, e.g. "Vehicle number matched". */
  detail?: string;
  fields?: Record<string, string>;
  confidence?: number;
  flags?: string[];
}

export interface DocumentIntelligenceClient {
  readonly transport: "unavailable" | "simulated" | "mcp";
  runStage(stage: VerificationStageId, request: DocumentAnalysisRequest): Promise<StageOutcome>;
}

/** Stage → MCP tool. The MCP server owns the implementations; the frontend only
 *  ever knows these names. */
export const MCP_TOOLS: Record<VerificationStageId, string> = {
  upload: "aegis.document.store",
  ocr: "aegis.document.ocr",
  metadata: "aegis.document.metadata",
  gps: "aegis.document.geo_verify",
  fraud: "aegis.document.fraud_check",
  blockchain: "aegis.document.blockchain_anchor",
};

export const STAGE_LABELS: Record<VerificationStageId, string> = {
  upload: "Upload",
  ocr: "OCR extraction",
  metadata: "Metadata check",
  gps: "Location check",
  fraud: "Fraud screening",
  blockchain: "Ledger anchor",
};

// ── Implementations ──────────────────────────────────────────────────────────

/** Production default until the services are wired: nothing is claimed. */
export function createUnavailableClient(): DocumentIntelligenceClient {
  return {
    transport: "unavailable",
    async runStage(stage) {
      return {
        status: "skipped",
        detail: `${STAGE_LABELS[stage]} service is not connected yet`,
      };
    },
  };
}

/** Plausible extractions per document kind, so a demo shows the real shape of
 *  the pipeline. Every result carries a `Simulated` flag — the UI surfaces it. */
const SIMULATED_FIELDS: Record<string, Record<string, string>> = {
  rc_book: { "Vehicle Number": "TN 09 AB 1234", Owner: "Sri Nivaspanneer", "Fuel Type": "Petrol" },
  driving_license: { "Licence Number": "TN0920190001234", "Valid Till": "2032-05-18" },
  aadhaar: { Name: "Sri Nivaspanneer", "Aadhaar": "XXXX XXXX 1234" },
  pan_card: { "PAN": "ABCDE1234F", Name: "Sri Nivaspanneer" },
  passport: { "Passport Number": "N1234567", "Valid Till": "2031-11-02" },
  visa: { "Visa Type": "Tourist", "Valid Till": "2027-03-14" },
  medical_report: { "Report Date": "2026-06-11", Facility: "Apollo Hospitals" },
  hospital_bill: { "Bill Amount": "₹42,300", "Bill Date": "2026-06-14" },
  sale_deed: { "Document Number": "TN/CHN/2019/4821", "Registered On": "2019-08-22" },
  tax_receipt: { "Assessment Year": "2026-27", "Amount Paid": "₹8,450" },
};

export interface SimulatedClientOptions {
  /** Per-stage think time. Tests pass 0. */
  delayMs?: number;
}

/**
 * Demo/dev implementation. Named "simulated" everywhere it surfaces so a
 * simulated pass is never mistaken for a real one.
 */
export function createSimulatedClient(
  options: SimulatedClientOptions = {},
): DocumentIntelligenceClient {
  const delayMs = options.delayMs ?? 650;

  return {
    transport: "simulated",
    async runStage(stage, request) {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

      if (stage === "ocr") {
        const fields = SIMULATED_FIELDS[request.kind];
        if (!fields) {
          return { status: "skipped", detail: "No extraction template for this document", flags: ["Simulated"] };
        }
        return {
          status: "passed",
          detail: `${Object.keys(fields).length} fields extracted`,
          fields,
          confidence: 0.94,
          flags: ["Simulated"],
        };
      }

      return {
        status: "passed",
        detail: `${STAGE_LABELS[stage]} passed`,
        flags: ["Simulated"],
      };
    },
  };
}

export type McpToolInvoker = (
  tool: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

/**
 * MCP-backed implementation. The invoker is injected, so this module stays
 * ignorant of the transport (stdio, HTTP, a backend proxy) — that decision
 * belongs to whoever wires the client up.
 */
export function createMcpClient(invoke: McpToolInvoker): DocumentIntelligenceClient {
  return {
    transport: "mcp",
    async runStage(stage, request) {
      const raw = await invoke(MCP_TOOLS[stage], { ...request });
      const result = (raw ?? {}) as Partial<StageOutcome>;
      // An MCP server is a remote peer, not a trusted branch of this app: a
      // malformed reply must not read as a pass.
      return {
        status: result.status === "passed" || result.status === "failed" ? result.status : "skipped",
        detail: typeof result.detail === "string" ? result.detail : undefined,
        fields: result.fields,
        confidence: typeof result.confidence === "number" ? result.confidence : undefined,
        flags: Array.isArray(result.flags) ? result.flags : undefined,
      };
    },
  };
}

export type DocumentIntelligenceMode = "unavailable" | "simulated" | "mcp";

export interface ClientConfig {
  mode?: DocumentIntelligenceMode;
  invoke?: McpToolInvoker;
  simulation?: SimulatedClientOptions;
}

/** Pick an implementation. `mcp` without an invoker degrades to `unavailable`
 *  rather than throwing — a missing transport must not break the upload UI. */
export function createDocumentIntelligenceClient(
  config: ClientConfig = {},
): DocumentIntelligenceClient {
  if (config.mode === "simulated") return createSimulatedClient(config.simulation);
  if (config.mode === "mcp" && config.invoke) return createMcpClient(config.invoke);
  return createUnavailableClient();
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineResult {
  stages: VerificationStage[];
  intelligence?: DocumentIntelligence;
}

/**
 * Run a document's stages in order, reporting each transition so the UI can
 * animate. A failed stage stops the pipeline — the stages after it are marked
 * `skipped`, because there is no point fraud-screening a document whose text
 * could not be read.
 */
export async function runVerificationPipeline(
  stageIds: VerificationStageId[],
  request: DocumentAnalysisRequest,
  client: DocumentIntelligenceClient,
  onStage?: (stage: VerificationStage) => void,
): Promise<PipelineResult> {
  const stages: VerificationStage[] = [];
  const fields: Record<string, string> = {};
  const flags: string[] = [];
  const confidences: number[] = [];
  let halted = false;

  for (const id of stageIds) {
    if (halted) {
      const skipped: VerificationStage = { id, status: "skipped", detail: "Earlier check did not pass" };
      stages.push(skipped);
      onStage?.(skipped);
      continue;
    }

    const running: VerificationStage = { id, status: "running" };
    onStage?.(running);

    let outcome: StageOutcome;
    try {
      outcome = await client.runStage(id, request);
    } catch (err) {
      outcome = {
        status: "failed",
        detail: err instanceof Error ? err.message : `${STAGE_LABELS[id]} could not be completed`,
      };
    }

    const settled: VerificationStage = { id, status: outcome.status, detail: outcome.detail };
    stages.push(settled);
    onStage?.(settled);

    if (outcome.fields) Object.assign(fields, outcome.fields);
    if (outcome.flags) flags.push(...outcome.flags);
    if (typeof outcome.confidence === "number") confidences.push(outcome.confidence);
    if (outcome.status === "failed") halted = true;
  }

  const hasIntelligence = Object.keys(fields).length > 0 || flags.length > 0;
  if (!hasIntelligence) return { stages };

  return {
    stages,
    intelligence: {
      fields,
      confidence: confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      flags: [...new Set(flags)],
    },
  };
}
