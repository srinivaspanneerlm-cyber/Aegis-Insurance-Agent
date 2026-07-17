import { ADVISORS } from "@/lib/advisors";
import { STORAGE_KEYS, agentHistoryKey } from "@/lib/storage-keys";

/**
 * Everything the browser keeps about who a customer is and what they discussed.
 *
 * Logging out is the customer saying they are finished with this device. Many
 * of ours are on a shared, borrowed, or public one, so anything still in
 * `localStorage` afterwards belongs to whoever opens the browser next — their
 * advisor transcript names conditions and income, and the session id would let
 * the next person resume their conversation on the server outright.
 *
 * The theme preference is deliberately left alone: it says nothing about the
 * customer, and wiping it would make logging out feel like a fault.
 *
 * This is the one place that decides what a logout purges. Anything new that
 * stores customer data in the browser belongs in this list.
 */
export function purgeCustomerSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.PURCHASE_SESSION);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_PLAN);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    for (const advisor of Object.values(ADVISORS)) {
      localStorage.removeItem(agentHistoryKey(advisor.pythonDomain));
    }
  } catch {
    // Storage can be unavailable (private mode, quota, disabled). Failing to
    // purge must never strand the customer in a session they asked to leave.
  }
}
