import { describe, it, expect } from "vitest";
import {
  inferDocumentRequest,
  parseDocumentRequest,
  resolveDocumentRequest,
} from "./parseDocumentRequest";

const tag = (json: string) => `[DOCUMENT_REQUEST:${json}]`;

describe("parseDocumentRequest — the structured tag", () => {
  it("returns null when the reply carries no tag", () => {
    expect(parseDocumentRequest("Let's start with your vehicle details.")).toBeNull();
  });

  it("builds requirements from the catalogue and strips the tag from the prose", () => {
    const text = `I need two things. ${tag('{"documents":[{"kind":"rc_book"},{"kind":"vehicle_photos"}]}')}`;
    const result = parseDocumentRequest(text, { agentName: "Alex AI", agentDomain: "motor" });

    expect(result!.cleanedText).toBe("I need two things.");
    expect(result!.request.source).toBe("ai-tag");
    expect(result!.request.agentName).toBe("Alex AI");
    expect(result!.request.requirements.map((r) => r.kind)).toEqual(["rc_book", "vehicle_photos"]);
    expect(result!.request.requirements[0].label.en).toBe("RC Book");
  });

  it("accepts `requirements` as well as `documents`", () => {
    const result = parseDocumentRequest(tag('{"requirements":[{"kind":"passport"}]}'));
    expect(result!.request.requirements[0].kind).toBe("passport");
  });

  it("lets the agent override catalogue copy and limits", () => {
    const json = '{"title":"Two more things","documents":[{"kind":"vehicle_photos","label":"Front & rear only","max_bytes":1048576,"required":false}]}';
    const req = parseDocumentRequest(tag(json))!.request;

    expect(req.title.en).toBe("Two more things");
    expect(req.requirements[0].label.en).toBe("Front & rear only");
    expect(req.requirements[0].maxBytes).toBe(1048576);
    expect(req.requirements[0].required).toBe(false);
  });

  it("keeps a document the catalogue does not know", () => {
    const req = parseDocumentRequest(tag('{"documents":[{"kind":"fitness_certificate"}]}'))!.request;
    expect(req.requirements[0].kind).toBe("fitness_certificate");
    expect(req.requirements[0].label.en).toBe("Fitness Certificate");
  });

  it("ignores a tag that names nothing usable", () => {
    expect(parseDocumentRequest(tag('{"documents":[]}'))).toBeNull();
    expect(parseDocumentRequest(tag('{"documents":[{"label":"no kind"}]}'))).toBeNull();
  });

  it("gives cards a stable id derived from the message", () => {
    const req = parseDocumentRequest(tag('{"documents":[{"kind":"visa"}]}'), { requestId: "msg-7" })!.request;
    expect(req.id).toBe("msg-7-docs");
  });
});

describe("inferDocumentRequest — plain prose", () => {
  it("picks up the documents an agent named without a tag", () => {
    const req = inferDocumentRequest("Please upload your RC book and Aadhaar to continue.", {
      agentDomain: "motor",
    });

    expect(req!.source).toBe("inferred");
    expect(req!.requirements.map((r) => r.kind)).toEqual(["rc_book", "aadhaar"]);
  });

  it("falls back to the domain set when the ask names no specific document", () => {
    const req = inferDocumentRequest("To proceed I'll need a few documents from you.", {
      agentDomain: "travel",
    });
    expect(req!.requirements.map((r) => r.kind)).toEqual(["passport", "visa", "boarding_pass"]);
  });

  it("understands a Thanglish ask", () => {
    const req = inferDocumentRequest("RC book anuppunga please", { agentDomain: "motor" });
    expect(req!.requirements.map((r) => r.kind)).toEqual(["rc_book"]);
  });

  it("does not fire on a reply that merely mentions a document", () => {
    // The agent is explaining, not asking — no cards should appear.
    expect(inferDocumentRequest("Your RC book stays with you at all times.", { agentDomain: "motor" })).toBeNull();
  });

  it("does not fire on an ask with nothing to ask for", () => {
    expect(inferDocumentRequest("Please share your thoughts on the premium.", { agentDomain: "motor" })).toBeNull();
  });

  it("returns null when a bare documents ask has no domain to fall back to", () => {
    expect(inferDocumentRequest("Please upload the required documents.", {})).toBeNull();
  });
});

describe("resolveDocumentRequest", () => {
  it("prefers the structured tag over inference", () => {
    const text = `Please upload your Aadhaar. ${tag('{"documents":[{"kind":"passport"}]}')}`;
    const result = resolveDocumentRequest(text, { agentDomain: "motor" });

    expect(result!.request.source).toBe("ai-tag");
    expect(result!.request.requirements.map((r) => r.kind)).toEqual(["passport"]);
  });

  it("falls back to inference and leaves the prose untouched", () => {
    const text = "Please upload your Aadhaar.";
    const result = resolveDocumentRequest(text, { agentDomain: "motor" });

    expect(result!.request.source).toBe("inferred");
    expect(result!.cleanedText).toBe(text);
  });

  it("returns null when the reply asks for nothing", () => {
    expect(resolveDocumentRequest("Happy to help — what's your budget?", { agentDomain: "motor" })).toBeNull();
  });
});
