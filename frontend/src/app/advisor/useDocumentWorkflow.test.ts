import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// The hook never touches the network in tests.
vi.mock("@/services/api", () => ({
  uploadService: { uploadDocument: vi.fn() },
}));

import { uploadService } from "@/services/api";
import type { ChatMsg } from "@/components/ChatMessage";
import { createSimulatedClient, createUnavailableClient } from "@/services/documentIntelligence";
import { useDocumentWorkflow, ADHOC_REQUIREMENT_ID } from "./useDocumentWorkflow";

const uploadDocument = vi.mocked(uploadService.uploadDocument);

beforeEach(() => {
  uploadDocument.mockReset();
  uploadDocument.mockResolvedValue({ id: "doc-1" });
});

const advisorMsg = (text: string, over: Partial<ChatMsg> = {}): ChatMsg => ({
  id: "m1",
  sender: "advisor",
  text,
  timestamp: "10:00",
  agentName: "Alex AI",
  agentDomain: "motor",
  ...over,
});

const file = (name = "rc.pdf", type = "application/pdf", size = 2048) =>
  new File(["x".repeat(size)], name, { type });

/** No verification service connected — the production default. */
const setup = (messages: ChatMsg[], onAllReceived?: (m: string) => void) =>
  renderHook(() =>
    useDocumentWorkflow({ messages, onAllReceived, client: createUnavailableClient() }),
  );

describe("useDocumentWorkflow — reading the transcript", () => {
  it("stays quiet until an agent actually asks for something", () => {
    const { result } = setup([advisorMsg("Hello! How can I help you today?")]);

    expect(result.current.request).toBeNull();
    expect(result.current.requestMessageId).toBeNull();
  });

  it("picks up a request the agent asked for in plain language", () => {
    const { result } = setup([advisorMsg("Please upload your RC book to continue.")]);

    expect(result.current.request?.source).toBe("inferred");
    expect(result.current.request?.requirements[0].kind).toBe("rc_book");
    expect(result.current.requestMessageId).toBe("m1");
  });

  it("lets a structured tag override the catalogue", () => {
    const tag = '[DOCUMENT_REQUEST:{"documents":[{"kind":"moon_permit","label":"Moon Permit"}]}]';
    const { result } = setup([advisorMsg(`Sure.\n${tag}`)]);

    expect(result.current.request?.source).toBe("ai-tag");
    expect(result.current.request?.requirements[0].kind).toBe("moon_permit");
  });

  it("follows the newest ask, not the first", () => {
    const { result } = setup([
      advisorMsg("Please upload your RC book.", { id: "old" }),
      advisorMsg("Actually, I need your Aadhaar instead.", { id: "new" }),
    ]);

    expect(result.current.requestMessageId).toBe("new");
    expect(result.current.request?.requirements[0].kind).toBe("aadhaar");
  });

  it("ignores a half-streamed message so cards do not flicker mid-reply", () => {
    const { result } = setup([advisorMsg("Please upload your RC book.", { isStreaming: true })]);
    expect(result.current.request).toBeNull();
  });
});

describe("useDocumentWorkflow — the picker", () => {
  it("opens against the requirement whose card was used", () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);
    const requirement = result.current.request!.requirements[0];

    act(() => result.current.openForRequirement(requirement));

    expect(result.current.picker?.requirement?.kind).toBe("rc_book");
  });

  it("carries an attachment source's own picker configuration", () => {
    const { result } = setup([]);

    act(() =>
      result.current.openForSource({
        id: "camera",
        label: { en: "Camera" },
        hint: { en: "Take a photo" },
        accept: ["image/jpeg"],
        maxBytes: 50 * 1024 * 1024,
        multiple: false,
        capture: "environment",
      }),
    );

    expect(result.current.picker).toMatchObject({
      accept: ["image/jpeg"],
      capture: "environment",
      autoOpenPicker: true,
    });
  });

  it("closes without attaching anything when no file is chosen", () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([]));

    expect(result.current.picker).toBeNull();
    expect(result.current.uploads).toHaveLength(0);
    expect(uploadDocument).not.toHaveBeenCalled();
  });
});

describe("useDocumentWorkflow — uploading", () => {
  it("sends the file and marks the transfer passed once it lands", async () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));

    await waitFor(() => expect(result.current.uploads[0].phase).toBe("completed"));

    expect(uploadDocument).toHaveBeenCalledTimes(1);
    expect(result.current.uploads[0].documentId).toBe("doc-1");
    expect(result.current.uploads[0].stages.find((s) => s.id === "upload")?.status).toBe("passed");
  });

  it("does not claim a check passed when no service ran it", async () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(result.current.uploads[0].phase).toBe("completed"));

    const checks = result.current.uploads[0].stages.filter((s) => s.id !== "upload");
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((s) => s.status === "skipped")).toBe(true);
    expect(result.current.steps[2].verified).toBe(false);
  });

  it("flags simulated results as simulated", async () => {
    const { result } = renderHook(() =>
      useDocumentWorkflow({
        messages: [advisorMsg("Please upload your RC book.")],
        client: createSimulatedClient({ delayMs: 0 }),
      }),
    );

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(result.current.uploads[0].phase).toBe("completed"));

    expect(result.current.uploads[0].intelligence?.flags).toContain("Simulated");
  });

  it("reports a failed upload without leaking the server's error", async () => {
    uploadDocument.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.4:4000"));
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));

    await waitFor(() => expect(result.current.uploads[0].phase).toBe("failed"));
    expect(result.current.uploads[0].error).toBe("That upload did not go through. Please try again.");
    expect(result.current.uploads[0].error).not.toContain("ECONNREFUSED");
  });

  it("retries a failed upload without asking for the file again", async () => {
    uploadDocument.mockRejectedValueOnce(new Error("nope"));
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(result.current.uploads[0].phase).toBe("failed"));

    act(() => result.current.retryUpload(result.current.uploads[0]));
    await waitFor(() => expect(result.current.uploads[0].phase).toBe("completed"));

    expect(uploadDocument).toHaveBeenCalledTimes(2);
  });

  it("drops an upload the customer removed", async () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(result.current.uploads).toHaveLength(1));

    act(() => result.current.removeUpload(result.current.uploads[0]));
    expect(result.current.uploads).toHaveLength(0);
  });

  it("keeps paperclip files apart from the documents that were asked for", async () => {
    const { result } = setup([advisorMsg("Please upload your RC book.")]);

    act(() =>
      result.current.openForSource({
        id: "images",
        label: { en: "Images" },
        hint: { en: "Photos" },
        accept: ["image/jpeg"],
        maxBytes: 50 * 1024 * 1024,
        multiple: true,
      }),
    );
    act(() => result.current.confirmFiles([file("holiday.jpg", "image/jpeg")]));

    await waitFor(() => expect(result.current.adhocUploads).toHaveLength(1));
    expect(result.current.adhocUploads[0].requirementId).toBe(ADHOC_REQUIREMENT_ID);
    // It answers no requirement, so it must not tick one off.
    expect(result.current.uploads).toHaveLength(0);
    expect(result.current.steps[1].progress).toBe(0);
  });
});

describe("useDocumentWorkflow — carrying the conversation on", () => {
  it("tells the page once every required document is in", async () => {
    const onAllReceived = vi.fn();
    const { result } = setup([advisorMsg("Please upload your RC book.")], onAllReceived);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));

    await waitFor(() => expect(onAllReceived).toHaveBeenCalledTimes(1));
    expect(onAllReceived.mock.calls[0][0]).toContain("RC Book");
  });

  it("does not continue while a file is still in flight", async () => {
    let release: (v: { id: string }) => void = () => {};
    uploadDocument.mockReturnValue(new Promise((r) => { release = r; }));

    const onAllReceived = vi.fn();
    const { result } = setup([advisorMsg("Please upload your RC book.")], onAllReceived);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));

    await waitFor(() => expect(result.current.uploads[0].phase).toBe("uploading"));
    expect(onAllReceived).not.toHaveBeenCalled();

    await act(async () => { release({ id: "doc-1" }); });
    await waitFor(() => expect(onAllReceived).toHaveBeenCalledTimes(1));
  });

  it("does not nag — one continuation per ask", async () => {
    const onAllReceived = vi.fn();
    const { result, rerender } = setup([advisorMsg("Please upload your RC book.")], onAllReceived);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(onAllReceived).toHaveBeenCalledTimes(1));

    rerender();
    expect(onAllReceived).toHaveBeenCalledTimes(1);
  });

  it("waits for every required document, not just the first", async () => {
    const onAllReceived = vi.fn();
    const tag =
      '[DOCUMENT_REQUEST:{"documents":[{"kind":"rc_book"},{"kind":"aadhaar"}]}]';
    const { result } = setup([advisorMsg(tag)], onAllReceived);

    act(() => result.current.openForRequirement(result.current.request!.requirements[0]));
    act(() => result.current.confirmFiles([file()]));
    await waitFor(() => expect(result.current.uploads[0].phase).toBe("completed"));
    expect(onAllReceived).not.toHaveBeenCalled();

    act(() => result.current.openForRequirement(result.current.request!.requirements[1]));
    act(() => result.current.confirmFiles([file("aadhaar.pdf")]));
    await waitFor(() => expect(onAllReceived).toHaveBeenCalledTimes(1));
  });
});
