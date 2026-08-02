import { describe, it, expect } from "vitest";
import { ACCEPT_IMAGERY, MIME } from "./registry";
import { requirementFromKind } from "./registry";
import { acceptAttribute, formatBytes, isAcceptedType, validateFile } from "./validation";

const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("validateFile", () => {
  it("accepts a normal PDF against a paperwork requirement", () => {
    const rc = requirementFromKind("rc_book");
    expect(validateFile(file("rc.pdf", 2_000_000, MIME.pdf), rc)).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateFile(file("rc.pdf", 0, MIME.pdf))!.code).toBe("empty");
  });

  it("rejects a format the requirement does not accept", () => {
    const photos = requirementFromKind("vehicle_photos");
    const rejection = validateFile(file("manual.pdf", 1000, MIME.pdf), photos);

    expect(rejection!.code).toBe("type");
    expect(rejection!.message.en).toContain("not a supported format");
  });

  it("rejects a file over the requirement's own limit", () => {
    const rc = requirementFromKind("rc_book"); // 10 MB
    const rejection = validateFile(file("scan.pdf", 12 * 1024 * 1024, MIME.pdf), rc);

    expect(rejection!.code).toBe("size");
    expect(rejection!.message.en).toContain("10 MB");
  });

  it("never lets a requirement raise the platform ceiling", () => {
    const huge = { ...requirementFromKind("vehicle_photos"), maxBytes: 500 * 1024 * 1024 };
    expect(validateFile(file("clip.mp4", 80 * 1024 * 1024, MIME.mp4), huge)!.code).toBe("size");
  });

  it("explains the rejection in Thanglish too", () => {
    const rejection = validateFile(file("virus.exe", 1000, "application/x-msdownload"));
    expect(rejection!.message.taEn).toContain("support aagala");
  });
});

describe("isAcceptedType", () => {
  it("matches on the reported MIME type", () => {
    expect(isAcceptedType(file("a.png", 1, MIME.png), ACCEPT_IMAGERY)).toBe(true);
  });

  it("falls back to the extension when the browser reports nothing usable", () => {
    // Safari sends an empty type for HEIC; Chrome sends octet-stream for DOCX.
    expect(isAcceptedType(file("photo.heic", 1, ""), ACCEPT_IMAGERY)).toBe(true);
    expect(isAcceptedType(file("photo.HEIC", 1, "application/octet-stream"), ACCEPT_IMAGERY)).toBe(true);
  });

  it("rejects an extensionless file with an unusable type", () => {
    expect(isAcceptedType(file("payload", 1, ""), ACCEPT_IMAGERY)).toBe(false);
  });
});

describe("acceptAttribute", () => {
  it("offers MIME types and extensions so every browser can filter", () => {
    const attr = acceptAttribute(ACCEPT_IMAGERY);
    expect(attr).toContain(MIME.png);
    expect(attr).toContain(".heic");
  });
});

describe("formatBytes", () => {
  it("scales the unit to the size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});
