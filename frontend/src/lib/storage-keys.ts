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
  /** Currently selected plan handed off into the purchase flow. */
  SELECTED_PLAN: "selectedPlanDetails",
  /** Serialized multi-step purchase state. */
  PURCHASE_SESSION: "aegis_purchase_session",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * One advisor's chat transcript, keyed by python domain — the only key here
 * that is built rather than fixed, since there is one per advisor.
 */
export const agentHistoryKey = (pythonDomain: string) => `aegis_hist_${pythonDomain}`;
