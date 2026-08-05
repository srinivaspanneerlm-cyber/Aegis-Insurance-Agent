/**
 * The four realms, and what each one is allowed to do.
 *
 * A realm answers "which portal is this person for". It is separate from a role
 * — which answers "what may they do once inside" — because conflating the two
 * is exactly how this codebase ended up with three disagreeing role
 * vocabularies. A realm changes almost never; a role changes when somebody's
 * job does.
 *
 * Everything a realm decides is data in this file: which sign-in methods it
 * accepts, whether a verified email is required, how long a sitting lasts,
 * whether a second factor will be demanded, and where a successful sign-in
 * lands. Written as one table, the differences between a customer session and a
 * platform-operator session are reviewable at a glance rather than scattered
 * across middleware.
 */

export const REALMS = ["CUSTOMER", "EMPLOYEE", "ENTERPRISE", "PLATFORM"] as const;
export type Realm = (typeof REALMS)[number];

export const isRealm = (value: unknown): value is Realm =>
  typeof value === "string" && (REALMS as readonly string[]).includes(value);

/** How somebody proves who they are. */
export const LOGIN_METHODS = ["PASSWORD", "google"] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface RealmPolicy {
  readonly realm: Realm;
  /** What a person is called here, in the interface. */
  readonly label: string;
  /**
   * The only ways in. A method absent from this list is refused before any
   * credential is examined — so a platform operator cannot be signed in by a
   * provider button that was never meant for them.
   */
  readonly methods: readonly LoginMethod[];
  /**
   * Whether a provider sign-in must come from a specific email domain.
   *
   * Empty means any domain. Non-empty is how "Google Workspace" differs from
   * "Google" — the same protocol, but only accepted from an organisation we
   * recognise. Configured per deployment; see `env.workspaceDomains`.
   */
  readonly requiresWorkspaceDomain: boolean;
  /**
   * Whether an unverified email address blocks sign-in.
   *
   * False for customers on purpose. Someone who has just registered and wants
   * to read about cover should not be stopped at a mail client — the
   * verification gate belongs in front of actions that matter, not in front of
   * the whole product. Staff realms are the other way round.
   */
  readonly requiresVerifiedEmail: boolean;
  /** Whether a second factor is required once one exists. */
  readonly requiresMfa: boolean;
  readonly accessTokenTtlMs: number;
  readonly sessionTtlMs: number;
  /** Sign out after this much inactivity; null disables it. */
  readonly idleTimeoutMs: number | null;
  /** Env key holding this realm's portal origin. */
  readonly portalEnvKey: string;
  /** Used when the env key is unset — the workspace's development ports. */
  readonly portalFallback: string;
}

/**
 * Customer sessions are long and forgiving; a person asked to sign in again
 * mid-application is a person who abandons it. Staff sessions run the other
 * way: they can read other people's records, so the inconvenience of signing in
 * again is cheaper than a session left open on an office machine.
 */
export const REALM_POLICIES: Record<Realm, RealmPolicy> = {
  CUSTOMER: {
    realm: "CUSTOMER",
    label: "Customer",
    methods: ["PASSWORD", "google"],
    requiresWorkspaceDomain: false,
    requiresVerifiedEmail: false,
    requiresMfa: false,
    accessTokenTtlMs: 15 * MINUTE,
    sessionTtlMs: 30 * DAY,
    idleTimeoutMs: 30 * MINUTE,
    portalEnvKey: "CUSTOMER_PORTAL_URL",
    portalFallback: "http://localhost:3000",
  },
  EMPLOYEE: {
    realm: "EMPLOYEE",
    label: "Employee",
    methods: ["PASSWORD", "google"],
    requiresWorkspaceDomain: true,
    requiresVerifiedEmail: true,
    requiresMfa: false,
    accessTokenTtlMs: 10 * MINUTE,
    sessionTtlMs: 12 * HOUR,
    idleTimeoutMs: 20 * MINUTE,
    portalEnvKey: "EMPLOYEE_PORTAL_URL",
    portalFallback: "http://localhost:3102",
  },
  ENTERPRISE: {
    realm: "ENTERPRISE",
    label: "Enterprise",
    // No password-only path by design: an enterprise administrator arrives
    // through their organisation's directory, which is also how their access
    // disappears the day that organisation removes them.
    methods: ["PASSWORD", "google"],
    requiresWorkspaceDomain: true,
    requiresVerifiedEmail: true,
    requiresMfa: false,
    accessTokenTtlMs: 10 * MINUTE,
    sessionTtlMs: 8 * HOUR,
    idleTimeoutMs: 15 * MINUTE,
    portalEnvKey: "ENTERPRISE_PORTAL_URL",
    portalFallback: "http://localhost:3103",
  },
  PLATFORM: {
    realm: "PLATFORM",
    label: "Platform administration",
    // Password only, deliberately. Platform authority must not depend on an
    // external provider's account-recovery process — whoever can reset a Google
    // account would otherwise be able to reach the platform's own controls.
    methods: ["PASSWORD"],
    requiresWorkspaceDomain: false,
    requiresVerifiedEmail: true,
    // The step-up mechanism already exists (`requireFreshAuth`); this flag is
    // what a real second factor will read when one is enrolled.
    requiresMfa: true,
    accessTokenTtlMs: 10 * MINUTE,
    sessionTtlMs: 4 * HOUR,
    idleTimeoutMs: 10 * MINUTE,
    portalEnvKey: "PLATFORM_ADMIN_URL",
    portalFallback: "http://localhost:3104",
  },
};

export const policyForRealm = (realm: Realm): RealmPolicy => REALM_POLICIES[realm];

/**
 * Whether this realm accepts this way of signing in.
 *
 * Checked before any credential is looked at, so a refusal here reveals nothing
 * about whether the account exists.
 */
export function realmAcceptsMethod(realm: Realm, method: LoginMethod): boolean {
  return REALM_POLICIES[realm].methods.includes(method);
}

/**
 * Where a successful sign-in lands.
 *
 * Read from the environment at call time rather than at module load, so a
 * deployment can change a portal origin without a rebuild — and so tests can
 * set one without reaching into module internals.
 */
export function portalUrlForRealm(realm: Realm, env: NodeJS.ProcessEnv = process.env): string {
  const policy = REALM_POLICIES[realm];
  const configured = env[policy.portalEnvKey];
  return configured && configured.trim() !== "" ? configured.trim() : policy.portalFallback;
}
