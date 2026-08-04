import { redirect } from "next/navigation";
import { CUSTOMER_HOME } from "@/lib/authRouting";

/**
 * `/dashboard` is the address customers bookmarked before the portal split its
 * consumer and staff surfaces. It still works.
 *
 * The redirect happens on the server: the old version shipped a client
 * component that mounted, showed a spinner, and only then navigated, so a
 * bookmark cost the customer a flash of an empty loading screen on the way to
 * a page they were already entitled to see.
 */
export default function LegacyDashboardRedirect() {
  redirect(CUSTOMER_HOME);
}
