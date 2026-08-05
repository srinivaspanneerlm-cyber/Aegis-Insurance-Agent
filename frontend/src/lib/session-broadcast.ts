/**
 * Tells the customer's other tabs what just happened to their session.
 *
 * People open our comparison pages in several tabs at once — that is how you
 * compare two policies. Before this, signing out in one of them left the others
 * showing a dashboard full of personal detail that no longer had a session
 * behind it: every action failed, and on a shared device the information stayed
 * on screen for whoever sat down next. Signing *in* had the mirror problem, a
 * tab left insisting the customer was a stranger.
 *
 * This carries no credential and no personal data — only which of two things
 * happened. The cookies remain the single source of truth; this just stops the
 * other tabs from being the last to know.
 */

export type SessionEvent = { type: "signed-in" } | { type: "signed-out" };

const CHANNEL_NAME = "aegis_session_events";

/**
 * Fallback key for browsers without `BroadcastChannel`.
 *
 * `storage` events fire in every *other* tab of the origin, which is the same
 * reach by a longer road. The timestamp is what makes the value change, so two
 * sign-outs in a row are two events rather than one.
 */
const FALLBACK_KEY = "aegis_session_event";

function hasBroadcastChannel(): boolean {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function";
}

/** Announce a session change to this customer's other tabs. */
export function publishSessionEvent(event: SessionEvent): void {
  if (typeof window === "undefined") return;

  if (hasBroadcastChannel()) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
      return;
    } catch {
      // Fall through to the storage route below.
    }
  }

  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ ...event, at: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode, quota, disabled). A session
    // change that other tabs never hear about is a stale tab, not a broken one
    // — every request they make is still authorised by the API.
  }
}

/**
 * Listen for session changes from the customer's other tabs.
 *
 * Neither transport delivers to the tab that sent the message, which is what we
 * want: the tab that acted has already updated itself.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToSessionEvents(handler: (event: SessionEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};

  if (hasBroadcastChannel()) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (message: MessageEvent) => {
        const data = message.data as SessionEvent | null;
        if (data?.type === "signed-in" || data?.type === "signed-out") handler(data);
      };
      return () => channel.close();
    } catch {
      // Fall through to the storage route below.
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FALLBACK_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as SessionEvent;
      if (data?.type === "signed-in" || data?.type === "signed-out") handler(data);
    } catch {
      // A value we did not write, or wrote in an older shape. Ignore it.
    }
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
