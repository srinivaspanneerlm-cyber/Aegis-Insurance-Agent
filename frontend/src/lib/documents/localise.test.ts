import { describe, it, expect } from "vitest";
import { localise } from "./localise";

describe("localise", () => {
  const full = { en: "Vehicle Photos", ta: "வாகன புகைப்படங்கள்", taEn: "Vehicle photos" };

  it("returns the requested language when it exists", () => {
    expect(localise(full, "en")).toBe("Vehicle Photos");
    expect(localise(full, "ta")).toBe("வாகன புகைப்படங்கள்");
    expect(localise(full, "taEn")).toBe("Vehicle photos");
  });

  it("defaults to English", () => {
    expect(localise(full)).toBe("Vehicle Photos");
  });

  it("falls back to English when a translation is missing", () => {
    expect(localise({ en: "Tax Receipt" }, "ta")).toBe("Tax Receipt");
  });

  it("prefers Tamil over English when Thanglish is missing", () => {
    expect(localise({ en: "Passport", ta: "கடவுச்சீட்டு" }, "taEn")).toBe("கடவுச்சீட்டு");
  });
});
