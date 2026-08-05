import type { Metadata } from "next";
import { StatusScreen } from "@/components/StatusScreen";
import { REALM_PRESENTATION, WEBSITE_URL } from "@/lib/identity";
import { readAuthParams, type RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Access denied" };

/**
 * Signed in, but not permitted here.
 *
 * Distinct from `/unauthorized`, and the distinction is the whole point: this
 * person is authenticated and we know who they are — they simply do not hold
 * what this portal requires. Telling them to sign in again, which is what a
 * merged screen would do, sends them round a loop that cannot end.
 */
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { realm } = await readAuthParams(searchParams);
  const presentation = REALM_PRESENTATION[realm];

  return (
    <StatusScreen
      icon="shield"
      title="You do not have access to this area"
      description="Your account is signed in, but it does not hold the permissions this part of Aegis requires."
      detail={`If you should have access to the ${presentation.label.toLowerCase()} portal, the person who administers it for your organisation can grant it. We do not name which permission was missing — that would map out the access model for anybody probing.`}
      actions={[
        { label: "Go to your own portal", href: "/", variant: "primary" },
        { label: "Back to the Aegis website", href: WEBSITE_URL, external: true },
      ]}
    />
  );
}
