import { describe, it, expect, vi } from "vitest";
import type { VerificationStage } from "@/types/documents";
import {
  MCP_TOOLS,
  createDocumentIntelligenceClient,
  createMcpClient,
  createSimulatedClient,
  createUnavailableClient,
  runVerificationPipeline,
} from "./documentIntelligence";

const request = {
  kind: "rc_book",
  fileName: "rc.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
};

describe("client selection", () => {
  it("defaults to the unavailable client", () => {
    expect(createDocumentIntelligenceClient().transport).toBe("unavailable");
  });

  it("degrades an MCP request with no invoker rather than throwing", () => {
    expect(createDocumentIntelligenceClient({ mode: "mcp" }).transport).toBe("unavailable");
  });

  it("uses MCP when an invoker is supplied", () => {
    expect(createDocumentIntelligenceClient({ mode: "mcp", invoke: vi.fn() }).transport).toBe("mcp");
  });
});

describe("unavailable client", () => {
  it("skips rather than claiming a document was verified", async () => {
    const outcome = await createUnavailableClient().runStage("fraud", request);
    expect(outcome.status).toBe("skipped");
    expect(outcome.detail).toContain("not connected");
  });
});

describe("simulated client", () => {
  const client = createSimulatedClient({ delayMs: 0 });

  it("labels every result as simulated", async () => {
    const outcome = await client.runStage("metadata", request);
    expect(outcome.status).toBe("passed");
    expect(outcome.flags).toContain("Simulated");
  });

  it("extracts document-appropriate fields at the OCR stage", async () => {
    const outcome = await client.runStage("ocr", request);
    expect(outcome.fields).toMatchObject({ "Vehicle Number": expect.any(String) });
    expect(outcome.confidence).toBeGreaterThan(0.5);
  });

  it("skips OCR for a document it has no template for", async () => {
    const outcome = await client.runStage("ocr", { ...request, kind: "drone_survey" });
    expect(outcome.status).toBe("skipped");
  });
});

describe("MCP client", () => {
  it("calls the tool that owns the stage and passes the document through", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "passed", detail: "ok" });
    const outcome = await createMcpClient(invoke).runStage("ocr", request);

    expect(invoke).toHaveBeenCalledWith(MCP_TOOLS.ocr, expect.objectContaining({ kind: "rc_book" }));
    expect(outcome.status).toBe("passed");
  });

  it("treats a malformed reply as skipped, never as a pass", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "definitely-fine" });
    expect((await createMcpClient(invoke).runStage("fraud", request)).status).toBe("skipped");

    const empty = vi.fn().mockResolvedValue(null);
    expect((await createMcpClient(empty).runStage("fraud", request)).status).toBe("skipped");
  });
});

describe("runVerificationPipeline", () => {
  const client = createSimulatedClient({ delayMs: 0 });

  it("runs the stages in order and reports each transition", async () => {
    const seen: VerificationStage[] = [];
    const result = await runVerificationPipeline(["upload", "ocr"], request, client, (s) => seen.push(s));

    expect(result.stages.map((s) => s.id)).toEqual(["upload", "ocr"]);
    expect(result.stages.every((s) => s.status === "passed")).toBe(true);
    expect(seen.map((s) => `${s.id}:${s.status}`)).toEqual([
      "upload:running", "upload:passed", "ocr:running", "ocr:passed",
    ]);
  });

  it("merges extracted fields and flags into one intelligence record", async () => {
    const result = await runVerificationPipeline(["upload", "ocr", "fraud"], request, client);

    expect(result.intelligence!.fields).toHaveProperty("Vehicle Number");
    expect(result.intelligence!.flags).toEqual(["Simulated"]); // de-duplicated
    expect(result.intelligence!.confidence).toBeGreaterThan(0);
  });

  it("stops at a failed stage and skips the rest", async () => {
    const failing = {
      transport: "simulated" as const,
      runStage: vi.fn(async (stage: string) =>
        stage === "ocr" ? { status: "failed" as const, detail: "Unreadable scan" } : { status: "passed" as const },
      ),
    };
    const result = await runVerificationPipeline(["upload", "ocr", "fraud"], request, failing);

    expect(result.stages.map((s) => s.status)).toEqual(["passed", "failed", "skipped"]);
    expect(failing.runStage).toHaveBeenCalledTimes(2); // fraud was never attempted
  });

  it("turns a thrown transport error into a failed stage", async () => {
    const broken = {
      transport: "mcp" as const,
      runStage: vi.fn().mockRejectedValue(new Error("MCP server unreachable")),
    };
    const result = await runVerificationPipeline(["ocr"], request, broken);

    expect(result.stages[0]).toMatchObject({ status: "failed", detail: "MCP server unreachable" });
  });

  it("reports no intelligence when nothing was extracted", async () => {
    const result = await runVerificationPipeline(["upload"], request, createUnavailableClient());
    expect(result.intelligence).toBeUndefined();
  });
});
