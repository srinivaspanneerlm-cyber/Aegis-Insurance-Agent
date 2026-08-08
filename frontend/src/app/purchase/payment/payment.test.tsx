/**
 * The payment step must not claim security it does not have.
 *
 * This form collects a full card number, expiry and CVV. There is no payment
 * processor behind it — no gateway, no backend endpoint, no model — and the
 * details go into React state and no further. It nonetheless displayed "SSL
 * Secured" beside a padlock, "Encrypted checkout", and a button reading "Pay
 * ₹X Securely".
 *
 * Those are the exact signals that persuade somebody a card is being handled
 * safely. Read the copy rather than rendering, because the claim is the copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(__dirname, ...parts), "utf8");

/** Strips comments, so an explanation of a removed claim is not read as the claim. */
const copy = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("payment step", () => {
  const page = copy(read("page.tsx"));

  it("makes no SSL or encryption claim", () => {
    expect(page).not.toMatch(/SSL/i);
    expect(page).not.toMatch(/encrypted/i);
  });

  it("does not invite the customer to pay securely", () => {
    expect(page).not.toMatch(/securely/i);
  });

  it("warns before the card fields, not after", () => {
    expect(page).toMatch(/Do not enter a real card/i);
    expect(page).toMatch(/role="alert"/);

    const warning = page.indexOf("Do not enter a real card");
    const cardField = page.indexOf("Card Number");
    expect(warning).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(cardField);
  });
});

describe("identity step", () => {
  const page = copy(read("..", "kyc", "page.tsx"));

  it("does not claim end-to-end encryption over identity documents", () => {
    expect(page).not.toMatch(/encrypted end-to-end/i);
    expect(page).not.toMatch(/256-bit/i);
  });

  it("tells somebody not to upload real documents", () => {
    expect(page).toMatch(/do not upload real identity documents/i);
  });
});

describe("details step", () => {
  it("does not claim the application is encrypted", () => {
    expect(copy(read("..", "details", "page.tsx"))).not.toMatch(/encrypted and secure/i);
  });
});
