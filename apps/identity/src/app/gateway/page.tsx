import type { Metadata } from "next";
import { PortalGateway } from "@/components/forms/PortalGateway";

export const metadata: Metadata = { title: "Choose a workspace" };

/**
 * The gateway every authenticated person passes through.
 *
 * The page itself is a server component with nothing to compute — the
 * entitlements are a per-session answer that only the API can give, and asking
 * for them here would mean forwarding the session cookie server-to-server for a
 * page that then still has to re-ask on every interaction. The client component
 * owns the request and the states around it.
 */
export default function GatewayPage() {
  return <PortalGateway />;
}
