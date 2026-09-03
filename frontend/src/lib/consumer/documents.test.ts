/**
 * The upload rules, and whether they still agree with the API.
 *
 * Client-side validation here is a courtesy, not a boundary — but a courtesy
 * that disagrees with the server is worse than none: it either turns away a
 * file the API would have taken, or waves through one it will refuse after the
 * customer has waited for it to upload. So the API's own files are read rather
 * than trusted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSUMER_ACCEPT,
  CONSUMER_FORMATS_LABEL,
  CONSUMER_MAX_BYTES,
  TRUST_STATE_META,
  TRUST_TONE_CLASS,
  formatSize,
  validatePolicyDocument,
} from "./documents";
import { localise } from "@/lib/documents/localise";

const backendFile = (...parts: string[]) =>
  readFileSync(join(__dirname, "..", "..", "..", "..", "backend", "src", ...parts), "utf8");

const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("which files are offered", () => {
  it("accepts PDF, JPG and PNG", () => {
    expect(validatePolicyDocument(file("cert.pdf", 1000, "application/pdf"))).toBeNull();
    expect(validatePolicyDocument(file("cert.jpg", 1000, "image/jpeg"))).toBeNull();
    expect(validatePolicyDocument(file("cert.jpeg", 1000, "image/jpeg"))).toBeNull();
    expect(validatePolicyDocument(file("cert.png", 1000, "image/png"))).toBeNull();
  });

  it("turns away the formats this flow does not take, even ones the platform does", () => {
    // DOCX, HEIC, WEBP and MP4 are all legitimate elsewhere on the platform.
    for (const name of ["policy.docx", "photo.heic", "photo.webp", "walkaround.mp4"]) {
      expect(validatePolicyDocument(file(name, 1000)), name).not.toBeNull();
    }
  });

  it("says what to send instead, rather than what was wrong", () => {
    const rejection = validatePolicyDocument(file("policy.docx", 1000));
    expect(localise(rejection!.message, "en")).toMatch(/Accepted: PDF, JPG, JPEG, PNG/);
  });

  it("falls back to the extension when the browser sends a useless type", () => {
    // Phone browsers routinely send an empty type or octet-stream for a photo.
    expect(validatePolicyDocument(file("cert.jpg", 1000, ""))).toBeNull();
    expect(validatePolicyDocument(file("cert.png", 1000, "application/octet-stream"))).toBeNull();
  });

  it("refuses an empty file before it is sent", () => {
    expect(validatePolicyDocument(file("cert.pdf", 0, "application/pdf"))?.code).toBe("empty");
  });

  it("refuses one over the limit and names the limit", () => {
    const rejection = validatePolicyDocument(
      file("cert.pdf", CONSUMER_MAX_BYTES + 1, "application/pdf")
    );
    expect(rejection?.code).toBe("size");
    expect(localise(rejection!.message, "en")).toMatch(/10 MB/);
  });

  it("explains itself in Tamil as well as English", () => {
    const rejection = validatePolicyDocument(file("cert.pdf", 0, "application/pdf"));
    expect(localise(rejection!.message, "taEn")).not.toBe(localise(rejection!.message, "en"));
  });
});

describe("the frontend and the API agree", () => {
  const apiDocuments = backendFile("consumer", "documents.ts");
  const apiConstants = backendFile("config", "constants.ts");

  it("offers exactly the formats the API accepts", () => {
    expect(apiDocuments).toContain('["pdf", "jpeg", "png"]');
    expect(CONSUMER_ACCEPT.sort()).toEqual(["application/pdf", "image/jpeg", "image/png"]);
  });

  it("uses the same default size limit", () => {
    // The API's is configurable and this one is not; the two defaults matching
    // is what stops a customer being told 10 MB and refused at 8.
    expect(apiConstants).toContain('num("CONSUMER_DOCUMENT_MAX_BYTES", 10 * 1024 * 1024)');
    expect(CONSUMER_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("describes the formats in the same words", () => {
    expect(apiDocuments).toContain(`"${CONSUMER_FORMATS_LABEL}"`);
  });

  it("has a badge for every state the API can return", () => {
    const apiStates = backendFile("consumer", "trustStatus.ts");
    for (const state of Object.keys(TRUST_STATE_META)) {
      expect(apiStates, `${state} is not a state the API emits`).toContain(`"${state}"`);
    }
    // And nothing the API emits is missing a badge, which would render blank.
    for (const state of ["UPLOADED", "NEEDS_CONFIRMATION", "CONSISTENCY_VERIFIED", "VERIFICATION_REQUIRED"]) {
      expect(TRUST_STATE_META[state as keyof typeof TRUST_STATE_META]).toBeDefined();
    }
  });
});

describe("how a state is drawn", () => {
  it("gives every state words in all three languages", () => {
    for (const [state, meta] of Object.entries(TRUST_STATE_META)) {
      for (const locale of ["en", "ta", "taEn"] as const) {
        expect(localise(meta.short, locale).length, `${state}/${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("styles every tone it defines", () => {
    for (const meta of Object.values(TRUST_STATE_META)) {
      expect(TRUST_TONE_CLASS[meta.tone]).toBeTruthy();
    }
  });

  it("never uses red", () => {
    // Red is for something the customer did wrong, and none of these four
    // states is that — two are questions, one is settled, one is unchecked.
    for (const cls of Object.values(TRUST_TONE_CLASS)) {
      expect(cls).not.toMatch(/rose|red/);
    }
  });
});

describe("sizes as a customer reads them", () => {
  it("scales the unit and says nothing when there is nothing to say", () => {
    expect(formatSize(900)).toBe("900 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatSize(null)).toBe("");
    expect(formatSize(0)).toBe("");
  });
});
