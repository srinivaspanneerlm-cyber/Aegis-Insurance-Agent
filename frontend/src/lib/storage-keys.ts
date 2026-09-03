/**
 * Canonical `localStorage` keys used across the app.
 *
 * These string keys were previously repeated as bare literals in multiple
 * files (theme, purchase flow, advisor session). A single typo in any copy
 * silently breaks persistence, so they are consolidated here as the one source
 * of truth. Values are byte-for-byte identical to the former literals — this is
 * a naming/dedup change only, with no behavioural effect.
 */
export const STORAGE_KEYS = {
  /** Persisted light/dark theme preference. */
  THEME: "aegis_theme",
  /** Advisor/voice conversation session id. */
  SESSION_ID: "aegis_session_id",
  /**
   * Which session id the home-page wake greeting was last spoken for.
   * `""` stands for "no conversation session existed yet" rather than absence
   * of the key, so a page load before any turn ever compares equal to itself.
   */
  GREETING_SESSION: "aegis_greeting_session",
  /**
   * Text carried from the home-page wake mic into `/advisor`'s first turn.
   * Session-only and consumed once — see `lib/wakeGreeting`.
   */
  VOICE_HANDOFF: "aegis_voice_handoff",
  /** Currently selected plan handed off into the purchase flow. */
  SELECTED_PLAN: "selectedPlanDetails",
  /** Serialized multi-step purchase state. */
  PURCHASE_SESSION: "aegis_purchase_session",
  /**
   * When this customer was last active, shared by every open tab so the idle
   * timeout measures the person rather than any one tab. Reading in one tab is
   * being present, even while three others sit untouched.
   */
  LAST_ACTIVITY: "aegis_last_activity",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * One advisor's chat transcript, keyed by python domain — the only key here
 * that is built rather than fixed, since there is one per advisor.
 */
export const agentHistoryKey = (pythonDomain: string) => `aegis_hist_${pythonDomain}`;
