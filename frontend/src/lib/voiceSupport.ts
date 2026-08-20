/**
 * Why voice input failed, and what the customer can actually do about it.
 *
 * The recogniser reports a handful of terse codes and one of them, `network`,
 * is badly named: Chromium's speech recognition streams microphone audio to
 * Google's servers, so *anything* that stops it reaching them arrives here as
 * "network" — including a browser that removed the key it needs.
 *
 * That distinction is the whole reason this file exists. Brave ships Chromium's
 * recogniser with Google's API key stripped out, on purpose, because it will
 * not send its users' audio to Google. `webkitSpeechRecognition` still exists,
 * so every support check passes, and then every attempt fails with `network`.
 * Telling that customer to "check your connection" sends them to reset a router
 * that is working perfectly, and it will never fix anything. It cost exactly
 * that here.
 *
 * So each message below names the real cause and always offers the way out that
 * works in every browser: type the question instead.
 */

export interface BrowserVoiceFacts {
  /** `navigator.onLine`. Only meaningful when false — it cannot prove reachability. */
  online: boolean;
  /** Brave, which blocks the speech service Chromium's recogniser depends on. */
  isBrave: boolean;
}

/**
 * What this browser is, as far as voice is concerned.
 *
 * Brave announces itself by injecting `navigator.brave`; that is Brave's own
 * documented way to be recognised, and no other browser defines it. Checked
 * synchronously rather than through `isBrave()`, which returns a promise — an
 * error message must not wait on one.
 */
export function readBrowserVoiceFacts(): BrowserVoiceFacts {
  if (typeof navigator === "undefined") return { online: true, isBrave: false };
  return {
    // `onLine` is only trusted in the negative: true means "an interface is up",
    // which is not the same as "Google is reachable".
    online: navigator.onLine !== false,
    isBrave: "brave" in navigator,
  };
}

/** When the browser has no speech recogniser at all — Firefox and Safari today. */
export function unsupportedBrowserMessage(facts: BrowserVoiceFacts): string {
  if (facts.isBrave) return braveMessage();
  return "This browser cannot listen. Open Aegis in Chrome to talk, or type your question here.";
}

function braveMessage(): string {
  // Named plainly, and not as a fault of Brave's: it is a deliberate privacy
  // choice, and a customer who chose Brave should not be told their browser is
  // broken. They just need to know it will not start working on a retry.
  return "Brave keeps your voice off Google's servers, so voice input cannot run here. Open Aegis in Chrome to talk, or type your question below.";
}

/**
 * Turn a recogniser error code into something the customer can act on.
 *
 * `facts` decides what `network` really means, which is the only code whose
 * plain reading is unreliable.
 */
export function speechErrorMessage(code: string, facts: BrowserVoiceFacts): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Mic blocked — allow microphone in browser settings.";

    case "audio-capture":
      // A dead end for voice until they change something about the device, so
      // it has to offer the route that works right now.
      return "Microphone not found, or another app is using it. Free it up and try again, or type your question instead.";

    case "no-speech":
      return "No speech detected. Tap mic and speak.";

    case "network":
      if (facts.isBrave) return braveMessage();
      if (!facts.online) {
        return "Voice needs an internet connection. You can type your question instead.";
      }
      // Online, not Brave: the speech service itself is unreachable — an
      // extension, a proxy or a firewall. Nothing the customer can fix from
      // here, so point at the thing that always works rather than at a setting.
      return "Voice input could not reach the speech service. Please type your question instead.";

    default:
      return "Voice unavailable. Try again, or type your question instead.";
  }
}
