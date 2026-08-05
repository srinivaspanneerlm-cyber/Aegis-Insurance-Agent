import type { Metadata } from "next";
import { AccessDenied } from "@/components/forms/AccessDenied";
import { PORTAL_NAMES } from "@/lib/identity";
import type { RawSearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Access denied" };

/**
 * Signed in, but not permitted here — a 403, not a 401.
 *
 * Distinct from `/unauthorized`, and the distinction is the whole point: this
 * person is authenticated and we know who they are. Telling them to sign in
 * again, which is what a merged screen would do, sends them round a loop that
 * cannot end.
 *
 * `?portal=` here is a portal id, not a realm — a portal refused them and named
 * itself. It is looked up rather than printed, so a hand-edited value cannot put
 * arbitrary text on the page.
 */
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.portal) ? params.portal[0] : params.portal;
  const portalName = (requested && PORTAL_NAMES[requested]) ?? null;

  return <AccessDenied portalName={portalName} />;
}
