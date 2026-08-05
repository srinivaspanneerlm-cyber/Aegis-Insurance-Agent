import type { Metadata } from "next";
import { StatusScreen } from "@/components/StatusScreen";
import { WEBSITE_URL } from "@/lib/identity";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Session ended" };

/**
 * Why the session ended, where we know it.
 *
 * An idle timeout and a password change elsewhere are very different pieces of
 * news, and a single "your session expired" would leave somebody who has just
 * been evicted by an intruder none the wiser.
 */
const REASONS: Record<string, string> = {
  idle: "You were signed out after a period of inactivity. On a shared or borrowed device that is what stops the next person seeing your details.",
  password:
    "Your password was changed, which signs out every device. If that was not you, reset it again immediately.",
  revoked:
    "This session was ended for safety — usually because a credential from it was reused somewhere unexpected. Signing in again is all that is needed.",
};

const DEFAULT_REASON =
  "Sessions do not last forever, which limits what a lost or borrowed device can expose.";

/**
 * The session ended while they were using it.
 *
 * Worth its own screen rather than folding into `/unauthorized`, because the
 * feeling is different: something was taken away mid-task, and the person
 * deserves to know it was expected rather than a fault.
 */
export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm, next, reason } = await readAuthParams(searchParams);
  const signInHref = `/login?portal=${realm}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <StatusScreen
      icon="clock"
      title="Your session has ended"
      description="You will need to sign in again to carry on. Nothing you saved has been lost."
      detail={(reason && REASONS[reason]) ?? DEFAULT_REASON}
      actions={[
        { label: "Sign in again", href: signInHref, variant: "primary" },
        { label: "Back to the Aegis website", href: WEBSITE_URL, external: true },
      ]}
    />
  );
}
