/**
 * What every way of signing in has to look like from the outside.
 *
 * Before this, "sign in with Google" was written directly into the auth
 * service: Google's library, Google's claim names and Google's failure modes,
 * all inlined next to the session logic. A second provider would have meant
 * copying that whole shape and keeping the two in step for ever.
 *
 * The observation that makes one interface possible is that the session layer
 * does not care *how* someone was identified. It needs exactly one answer —
 * "who is this, and is the provider sure?" — and everything specific to a
 * provider can stop at that boundary.
 */

/**
 * A provider's verified answer about a person.
 *
 * Only fields the platform actually acts on. Providers return far more than
 * this, and copying it through would make every future provider a negotiation
 * about which claims to add.
 */
export interface VerifiedIdentity {
  /** The registry id of the provider that vouched for this — e.g. `"google"`. */
  readonly provider: string;
  /**
   * The provider's own stable id for this person. This — not the email — is
   * the durable link, because people change their email address and the
   * account has to survive it.
   */
  readonly subject: string;
  /**
   * Lower-cased, and **only ever present when the provider says it is
   * verified**. An unverified email is worthless for matching: anyone can
   * claim one, and matching on it would hand over the existing Aegis account
   * that already uses it.
   */
  readonly email: string;
  readonly displayName: string | null;
  readonly pictureUrl: string | null;
}

export interface IdentityProvider {
  /** Registry key, and the value stored in `LinkedIdentity.provider`. */
  readonly id: string;
  /** How this provider is named to a customer. */
  readonly label: string;
  /**
   * Whether this deployment has the configuration to use it. A provider with
   * no client id is not an error to start up with — most deployments will
   * enable a subset — but it must refuse to run rather than half-verify.
   */
  readonly isConfigured: boolean;
  /**
   * Turn a credential from the client into an identity, or `null` if the
   * provider would not vouch for it.
   *
   * Returning `null` rather than throwing is deliberate: every rejection
   * reason — bad signature, wrong audience, expired, unverified email — must
   * reach the customer as the same message, because the differences between
   * them are only useful to somebody probing the endpoint.
   */
  verify(credential: string): Promise<VerifiedIdentity | null>;
}
