import type { Metadata } from "next";
import { StatusScreen } from "@/components/StatusScreen";
import { WEBSITE_URL } from "@/lib/identity";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Sign in required" };

/**
 * Not signed in at all.
 *
 * The counterpart to `/access-denied`. Here the answer really is "sign in", and
 * the destination travels through `?next=` so the person lands where they were
 * going rather than on a page they did not ask for.
 *
 * `next` has already been through the open-redirect guard in `readAuthParams`.
 * Without it, `/unauthorized?next=https://evil.example` would send a freshly
 * signed-in person off the site with their guard down.
 */
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm, next } = await readAuthParams(searchParams);
  const signInHref = `/login?portal=${realm}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <StatusScreen
      icon="lock"
      title="Please sign in to continue"
      description="That page needs a signed-in account. Nothing is wrong — you either have not signed in yet, or your session has already ended."
      detail="We will bring you back to the page you were trying to reach once you are in."
      actions={[
        { label: "Sign in", href: signInHref, variant: "primary" },
        { label: "Back to the Aegis website", href: WEBSITE_URL, external: true },
      ]}
    />
  );
}
