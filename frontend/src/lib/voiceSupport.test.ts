/**
 * The message a customer gets when voice fails.
 *
 * One of these was wrong in a way that cost real time: Brave blocks the speech
 * service on purpose, the recogniser reports that as `network`, and the app
 * told the customer to check a connection that was working. These tests pin
 * each cause to a message that names it and offers a way forward.
 */
import { describe, it, expect } from "vitest";
import {
  readBrowserVoiceFacts,
  speechErrorMessage,
  unsupportedBrowserMessage,
  type BrowserVoiceFacts,
} from "./voiceSupport";

const CHROME_ONLINE: BrowserVoiceFacts = { online: true, isBrave: false };
const CHROME_OFFLINE: BrowserVoiceFacts = { online: false, isBrave: false };
const BRAVE: BrowserVoiceFacts = { online: true, isBrave: true };

describe("speechErrorMessage", () => {
  it("does not blame the connection when the connection is fine", () => {
    // The defect this file exists for: online, in Brave, told to check a router.
    const msg = speechErrorMessage("network", BRAVE);
    expect(msg).not.toMatch(/check your connection|needs an internet/i);
    expect(msg).toMatch(/brave/i);
  });

  it("tells a Brave customer that retrying will not help", () => {
    const msg = speechErrorMessage("network", BRAVE);
    expect(msg).toMatch(/chrome/i);
    expect(msg).toMatch(/type/i);
  });

  it("does blame the connection when the device is actually offline", () => {
    expect(speechErrorMessage("network", CHROME_OFFLINE)).toMatch(/internet/i);
  });

  it("says the speech service is unreachable when online and not in Brave", () => {
    const msg = speechErrorMessage("network", CHROME_ONLINE);
    expect(msg).toMatch(/speech service/i);
    expect(msg).not.toMatch(/brave/i);
  });

  it("keeps the codes whose plain reading is already correct", () => {
    expect(speechErrorMessage("not-allowed", CHROME_ONLINE)).toMatch(/mic blocked/i);
    expect(speechErrorMessage("service-not-allowed", CHROME_ONLINE)).toMatch(/mic blocked/i);
    expect(speechErrorMessage("audio-capture", CHROME_ONLINE)).toMatch(/microphone not found/i);
    expect(speechErrorMessage("no-speech", CHROME_ONLINE)).toMatch(/no speech detected/i);
  });

  it("leaves a way to carry on wherever voice is a dead end", () => {
    // Typing works in every browser, so any message that means "voice cannot
    // proceed" has to point at it. `no-speech` is exempt — that one is simply
    // "say it again" — and `not-allowed` names the setting that fixes it.
    for (const code of ["network", "audio-capture", "something-new"]) {
      for (const facts of [CHROME_ONLINE, CHROME_OFFLINE, BRAVE]) {
        expect(speechErrorMessage(code, facts)).toMatch(/type/i);
      }
    }
  });

  it("has a sensible answer for a code it has never seen", () => {
    expect(speechErrorMessage("language-not-supported", CHROME_ONLINE)).toMatch(/voice unavailable/i);
  });
});

describe("unsupportedBrowserMessage", () => {
  it("points a Firefox customer at Chrome, and at the textarea", () => {
    const msg = unsupportedBrowserMessage(CHROME_ONLINE);
    expect(msg).toMatch(/chrome/i);
    expect(msg).toMatch(/type/i);
  });

  it("gives Brave its real reason rather than 'unsupported'", () => {
    expect(unsupportedBrowserMessage(BRAVE)).toMatch(/brave/i);
  });
});

describe("readBrowserVoiceFacts", () => {
  it("recognises Brave by the object Brave injects", () => {
    const nav = navigator as Navigator & { brave?: unknown };
    expect(readBrowserVoiceFacts().isBrave).toBe(false);

    Object.defineProperty(nav, "brave", { value: {}, configurable: true });
    try {
      expect(readBrowserVoiceFacts().isBrave).toBe(true);
    } finally {
      delete nav.brave;
    }
  });

  it("treats an unknown onLine as online, never as offline", () => {
    // `onLine` is only trusted in the negative — true does not prove Google is
    // reachable, and guessing offline would print the wrong message again.
    expect(readBrowserVoiceFacts().online).toBe(true);
  });
});
