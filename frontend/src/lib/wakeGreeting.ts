/**
 * The home page's entry point into voice: recognising "Hello Aegis" in a
 * transcript, and the canned self-introduction that answers it.
 *
 * This is deliberately not a second speech engine. It runs on whatever text
 * `useVoiceRuntime` already produced — browser or server transcription, same
 * as every other turn — and decides one thing: does this turn start with a
 * wake phrase, and if so, is there anything after it. Everything downstream
 * (the actual conversation) still goes through the one existing send path;
 * see `components/home/VoiceGreeting`.
 *
 * Pattern-matched like `lib/voiceStyle`, not modelled, for the same three
 * reasons: it must not guess at intent beyond the words said, it must not
 * spend a paid LLM call recognising two words, and it must be inspectable
 * when someone asks "why did it wake just now".
 */
import { STORAGE_KEYS } from "./storage-keys";

const TAMIL_GREETING_WORDS = ["vanakkam", "வணக்கம்"];
const GREETING_WORDS = ["hello", "hey", "hi", "namaste", ...TAMIL_GREETING_WORDS];

/**
 * Anchored to the *start* of the utterance — a customer mentioning "aegis"
 * partway through a sentence ("...my aegis policy...") must never wake the
 * assistant, only someone addressing it must. The greeting word is optional
 * so a bare "Aegis, ..." still wakes it, matching the spec's "reasonable
 * variation" requirement without trying to enumerate every phrasing.
 */
const WAKE_RE = new RegExp(
  `^\\s*(${GREETING_WORDS.join("|")})?\\s*,?\\s*aegis\\b[,.!]?\\s*`,
  "i"
);

/** Tamil script anywhere in the block — Unicode Tamil is U+0B80–U+0BFF. */
const TAMIL_SCRIPT_RE = /[஀-௿]/;

export interface WakeMatch {
  /** Whether this utterance opens with a recognised wake phrase. */
  isWake: boolean;
  /** Whatever followed the wake phrase, trimmed. Empty for a bare "Hello Aegis". */
  remainder: string;
  /** Whether the wake phrase itself was said in Tamil or Tamil script. */
  tamil: boolean;
}

/**
 * Reads a transcript for a wake phrase.
 *
 * `remainder` matters more than `isWake` for a caller: a wake phrase with
 * content after it ("Hello Aegis, I need motor insurance") should go straight
 * to the orchestrator like any other turn — the existing language layer
 * there already answers in Tamil/Thanglish when asked in it. Only a *bare*
 * wake phrase is answered locally, with the canned self-introduction.
 */
export function matchWakePhrase(text: string | null | undefined): WakeMatch {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { isWake: false, remainder: "", tamil: false };

  const match = WAKE_RE.exec(trimmed);
  if (!match) return { isWake: false, remainder: "", tamil: false };

  const greetingWord = (match[1] || "").toLowerCase();
  const remainder = trimmed.slice(match[0].length).trim();
  const tamil =
    TAMIL_GREETING_WORDS.some((w) => w.toLowerCase() === greetingWord) ||
    TAMIL_SCRIPT_RE.test(trimmed);

  return { isWake: true, remainder, tamil };
}

/** The short self-introduction, spoken once per session. Never an LLM call. */
export function greetingFor(tamil: boolean): string {
  return tamil
    ? "Vanakkam sir. Naan Aegis. Ungalukku enna help venum?"
    : "Hello sir. I'm Aegis. How can I help you?";
}

// ── Session-scoped "have we already greeted" ─────────────────────────────────
//
// Keyed by the conversation session id, not a plain boolean: a refresh or
// reconnect that keeps the same `aegis_session_id` must not hear the greeting
// twice, but a genuinely new conversation (a different id, including the
// empty string standing for "no conversation minted yet") should. `""` is a
// real, storable value here — the same reasoning `VoiceSession` gives
// `lastCompletedTurn: null` for "nothing yet" rather than treating absence
// specially.

export function hasGreetedThisSession(sessionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.GREETING_SESSION) === sessionId;
  } catch {
    return false;
  }
}

export function markGreetedThisSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.GREETING_SESSION, sessionId);
  } catch {
    // Best-effort only — worst case the greeting is heard twice.
  }
}
