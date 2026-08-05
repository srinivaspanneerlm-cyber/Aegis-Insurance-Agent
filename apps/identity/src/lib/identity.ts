/**
 * What the identity platform knows about realms, portals and its own routes.
 *
 * The realm table here mirrors the backend's `src/auth/realms.ts`. It is
 * deliberately presentation-only — labels, descriptions, which buttons to draw
 * — and decides nothing. The server refuses a wrong-realm sign-in on its own;
 * if this file and that one ever disagree, the worst outcome is a button that
 * turns out not to work, not an unauthorised entry.
 */

export const REALMS = ["CUSTOMER", "EMPLOYEE", "ENTERPRISE", "PLATFORM"] as const;
export type Realm = (typeof REALMS)[number];

export const isRealm = (value: unknown): value is Realm =>
  typeof value === "string" && (REALMS as readonly string[]).includes(value);

export interface RealmPresentation {
  readonly realm: Realm;
  readonly label: string;
  readonly audience: string;
  /** Shown under the heading on the sign-in screen. */
  readonly blurb: string;
  readonly allowsPassword: boolean;
  readonly allowsProvider: boolean;
  /** Whether self-registration is offered. Staff accounts are provisioned. */
  readonly allowsRegistration: boolean;
  /** A note about how accounts here are obtained, when they cannot be created. */
  readonly provisioningNote?: string;
}

export const REALM_PRESENTATION: Record<Realm, RealmPresentation> = {
  CUSTOMER: {
    realm: "CUSTOMER",
    label: "Customer",
    audience: "For individuals and families",
    blurb:
      "Sign in to see the cover you hold, continue an application, or pick up where you left off.",
    allowsPassword: true,
    allowsProvider: true,
    allowsRegistration: true,
  },
  EMPLOYEE: {
    realm: "EMPLOYEE",
    label: "Employee",
    audience: "For branch and support staff",
    blurb: "Sign in with your work account to reach the customers and applications you handle.",
    allowsPassword: true,
    allowsProvider: true,
    allowsRegistration: false,
    provisioningNote: "Employee accounts are created by your branch administrator.",
  },
  ENTERPRISE: {
    realm: "ENTERPRISE",
    label: "Enterprise",
    audience: "For underwriting and oversight",
    blurb: "Sign in with your corporate account to reach portfolio and approval tools.",
    allowsPassword: true,
    allowsProvider: true,
    allowsRegistration: false,
    provisioningNote: "Enterprise access is arranged through your organisation.",
  },
  PLATFORM: {
    realm: "PLATFORM",
    label: "Platform administration",
    audience: "For Aegis operators",
    // Password only, and the screen says why rather than leaving the missing
    // button looking like an oversight.
    blurb:
      "Sign in with your platform credentials. Provider sign-in is not accepted here, so that platform access never depends on an external account recovery.",
    allowsPassword: true,
    allowsProvider: false,
    allowsRegistration: false,
    provisioningNote: "Platform accounts are issued directly by Aegis.",
  },
};

/** The public website — where somebody lands when they back out of signing in. */
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3100";

/**
 * Where the API lives.
 *
 * Same origin as the portals' API, because the session cookie it sets has to be
 * the one those portals send. An identity app on a different API would mint
 * sessions nothing else recognises.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

/**
 * Which realm a request is for.
 *
 * Read from `?portal=` so the website's gateway can hand somebody straight to
 * the right door. An unrecognised or absent value falls back to CUSTOMER —
 * the overwhelmingly common case, and the least privileged.
 */
export function realmFromParam(value: string | string[] | undefined): Realm {
  const first = Array.isArray(value) ? value[0] : value;
  return isRealm(first) ? first : "CUSTOMER";
}

/**
 * Only allow a return path that stays on this site.
 *
 * `?next=` is attacker-controlled. Without this, a link to
 * `/login?next=https://evil.example` would send a freshly signed-in person
 * somewhere else entirely, with their guard down — the classic open redirect.
 * Anything that is not a plain absolute path is discarded.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  // Must start with a single slash. `//evil.example` is protocol-relative and
  // would leave the site despite looking local.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}
