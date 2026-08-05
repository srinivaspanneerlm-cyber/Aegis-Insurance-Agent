/**
 * The portal catalogue, and who may enter which.
 *
 * A portal is a deployed application; a realm is the kind of person a portal
 * serves. They are one-to-one today and this file is where that mapping lives —
 * so the question "may this person enter that portal" has exactly one answer,
 * on the server, rather than being re-derived by each client that asks.
 *
 * The descriptions are the ones a person reads on the gateway. They describe
 * the work, never the machinery: nothing here names an agent, a service or an
 * internal component, because the gateway is the first thing an authenticated
 * stranger sees and it is not a place to describe how the platform is built.
 */
import { REALMS, portalUrlForRealm, type Realm } from "./realms";

export interface PortalDefinition {
  readonly id: string;
  readonly realm: Realm;
  readonly name: string;
  readonly description: string;
  /** Icon name the gateway renders. Presentation, chosen once, server-side. */
  readonly icon: string;
}

export const PORTALS: readonly PortalDefinition[] = [
  {
    id: "customer",
    realm: "CUSTOMER",
    name: "Customer Portal",
    description: "Manage policies, claims, renewals and insurance services.",
    icon: "users",
  },
  {
    id: "employee",
    realm: "EMPLOYEE",
    name: "Employee Portal",
    description: "Customer support, KYC verification, policy processing and operations.",
    icon: "briefcase",
  },
  {
    id: "enterprise",
    realm: "ENTERPRISE",
    name: "Enterprise Portal",
    description: "Business analytics, operations, compliance and management.",
    icon: "building",
  },
  {
    id: "platform",
    realm: "PLATFORM",
    name: "Platform Administration",
    description: "Infrastructure, monitoring, platform management and security.",
    icon: "layers",
  },
];

const BY_ID = new Map(PORTALS.map((portal) => [portal.id, portal]));

export const getPortal = (id: string): PortalDefinition | null => BY_ID.get(id) ?? null;

/**
 * A portal as the gateway should render it for one particular person.
 *
 * `url` is present only when they may actually enter. That is the important
 * part: a client cannot construct a destination it was not given, so a
 * hand-edited URL in the address bar has nothing to reach for.
 */
export interface PortalEntitlement {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly entitled: boolean;
  readonly url: string | null;
}

/**
 * What this person sees on the gateway.
 *
 * Every portal is listed, including the ones they cannot enter, and that is
 * deliberate. A gateway showing only what somebody already has is a page with
 * one card on it — while showing the whole set, with the rest visibly closed,
 * tells them the shape of the platform and why this is the door they get. The
 * public website already names all four, so nothing is disclosed here that was
 * not already public.
 *
 * The closed ones carry no URL, so "listed" never means "reachable".
 */
export function entitlementsFor(realm: Realm, env: NodeJS.ProcessEnv = process.env) {
  return PORTALS.map<PortalEntitlement>((portal) => {
    const entitled = portal.realm === realm;
    return {
      id: portal.id,
      name: portal.name,
      description: portal.description,
      icon: portal.icon,
      entitled,
      url: entitled ? portalUrlForRealm(portal.realm, env) : null,
    };
  });
}

/** The one portal this realm belongs to. Used for "return to my portal". */
export function homePortalFor(realm: Realm): PortalDefinition {
  const home = PORTALS.find((portal) => portal.realm === realm);
  // Every realm has exactly one portal, and the types make that true — but a
  // future realm added without a portal must fail loudly here rather than
  // silently sending somebody nowhere.
  if (!home) throw new Error(`No portal is defined for realm "${realm}"`);
  return home;
}

/** Sanity: every realm has a portal, checked once at module load. */
for (const realm of REALMS) homePortalFor(realm);
