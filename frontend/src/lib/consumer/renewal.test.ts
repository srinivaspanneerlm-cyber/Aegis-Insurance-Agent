/**
 * The renewal choices, and whether the agreement still matches the API's.
 *
 * The parity check is the one that matters. The consent record stores the
 * *server's* wording, and this screen shows its own copy of it — so a silent
 * divergence means somebody agreeing to one sentence and being recorded as
 * having agreed to another. That is not a cosmetic bug, and it is invisible
 * without a test that reads both files.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNEL_CHOICES,
  CONSENT_EXPLAINER,
  CONSENT_TEXT,
  REQUEST_STATUS_EXPLAINER,
  REQUEST_STATUS_TONE,
  channelChoice,
  channelNeedsPhone,
} from "./renewal";
import { localise } from "@/lib/documents/localise";

const backend = (...parts: string[]) =>
  readFileSync(join(__dirname, "..", "..", "..", "..", "backend", "src", ...parts), "utf8");

describe("how somebody may ask to be contacted", () => {
  it("offers exactly the three channels the product specifies", () => {
    expect(CHANNEL_CHOICES.map((c) => c.id)).toEqual(["CALL", "WHATSAPP", "EMAIL"]);
  });

  it("knows which ones cannot be worked without a number", () => {
    expect(channelNeedsPhone("CALL")).toBe(true);
    expect(channelNeedsPhone("WHATSAPP")).toBe(true);
    expect(channelNeedsPhone("EMAIL")).toBe(false);
    expect(channelNeedsPhone("")).toBe(false);
  });

  it("says what actually happens, not just what the channel is called", () => {
    // "WhatsApp" tells somebody nothing about whether a robot will message them.
    for (const choice of CHANNEL_CHOICES) {
      expect(localise(choice.detail, "en").length, choice.id).toBeGreaterThan(20);
      expect(localise(choice.detail, "en")).not.toBe(localise(choice.label, "en"));
    }
  });

  it("promises no automation on the WhatsApp option", () => {
    const whatsapp = channelChoice("WHATSAPP");
    expect(localise(whatsapp!.detail, "en")).toMatch(/Nothing is sent automatically/i);
  });

  it("names every channel in all three languages", () => {
    for (const choice of CHANNEL_CHOICES) {
      for (const locale of ["en", "ta", "taEn"] as const) {
        expect(localise(choice.label, locale).length, `${choice.id}/${locale}`).toBeGreaterThan(0);
        expect(localise(choice.detail, locale).length, `${choice.id}/${locale}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("the agreement matches the one the API records", () => {
  const messages = backend("consumer", "messages.ts");

  it("shows the same words for being contacted", () => {
    // Compared character for character. The record stores the server's version;
    // a screen showing anything else is recording an agreement nobody made.
    expect(messages).toContain(CONSENT_TEXT.RENEWAL_ASSISTANCE.en);
  });

  it("shows the same words for being reminded", () => {
    expect(messages).toContain(CONSENT_TEXT.RENEWAL_REMINDER.en);
  });

  it("shows the same explainer", () => {
    expect(messages).toContain(CONSENT_EXPLAINER.en);
  });

  it("keeps the Tamil in step too", () => {
    // The people most likely to read this are the ones most likely to read it
    // in Tamil. A hash over the English alone would prove the wrong thing.
    expect(messages).toContain(CONSENT_TEXT.RENEWAL_ASSISTANCE.ta as string);
    expect(messages).toContain(CONSENT_TEXT.RENEWAL_REMINDER.ta as string);
  });

  it("says the three things a consent has to say", () => {
    const text = CONSENT_TEXT.RENEWAL_ASSISTANCE.en;
    expect(text).toMatch(/not an insurer/i);
    expect(text).toMatch(/not take any payment/i);
    expect(text).toMatch(/stop at any time/i);
  });

  it("keeps being helped once and being reminded forever separate", () => {
    expect(CONSENT_TEXT.RENEWAL_REMINDER.en).toMatch(/separate choice/i);
  });
});

describe("explaining where a request has got to", () => {
  const workflow = backend("consumer", "renewalLead.ts");

  it("explains every state the API can send", () => {
    // Otherwise a customer reads "PARTNER_HANDOFF" — an operations word — and
    // learns nothing about what is happening to them.
    for (const status of ["NEW", "CONTACTED", "QUOTE_REQUESTED", "PARTNER_HANDOFF", "CLOSED"]) {
      expect(workflow, `${status} is not a state the API emits`).toContain(`"${status}"`);
      expect(REQUEST_STATUS_EXPLAINER[status], `${status} has no explanation`).toBeDefined();
      expect(REQUEST_STATUS_TONE[status], `${status} has no tone`).toBeDefined();
    }
  });

  it("explains them in all three languages", () => {
    for (const [status, text] of Object.entries(REQUEST_STATUS_EXPLAINER)) {
      for (const locale of ["en", "ta", "taEn"] as const) {
        expect(localise(text, locale).length, `${status}/${locale}`).toBeGreaterThan(10);
      }
    }
  });

  it("says plainly that a partner issues the policy, not Aegis", () => {
    expect(localise(REQUEST_STATUS_EXPLAINER.PARTNER_HANDOFF, "en")).toMatch(/not us/i);
  });

  it("never draws a request as an error", () => {
    // None of these five states is something the customer did wrong.
    for (const tone of Object.values(REQUEST_STATUS_TONE)) {
      expect(["neutral", "active", "settled"]).toContain(tone);
    }
  });
});
