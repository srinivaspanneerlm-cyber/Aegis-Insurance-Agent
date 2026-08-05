/**
 * The identity provider registry.
 *
 * Adding a way in — Microsoft for a corporate group scheme, Apple for iOS
 * customers, an insurer's OIDC, an Aadhaar broker for rural onboarding — is
 * now one file plus one line in the map below. No route changes, no new
 * columns, and no edit to the session logic, which is the part it would be
 * expensive to get wrong twice.
 *
 * Unknown ids resolve to nothing rather than to a default. A registry that
 * quietly falls back to Google would turn a typo in a deployment config into a
 * silent change of who is trusted to identify customers.
 */
import type { IdentityProvider } from "./types";
import { googleProvider } from "./google.provider";

const registry = new Map<string, IdentityProvider>([[googleProvider.id, googleProvider]]);

/**
 * Add a provider to the registry.
 *
 * The extension point. Registering under an id that is already taken is
 * refused rather than silently overwriting — quietly replacing who verifies
 * customer identities is not something a stray import should be able to do.
 */
export function registerIdentityProvider(provider: IdentityProvider): void {
  if (registry.has(provider.id)) {
    throw new Error(`Identity provider "${provider.id}" is already registered.`);
  }
  registry.set(provider.id, provider);
}

/** The provider registered under this id, or null. Never falls back. */
export function getIdentityProvider(id: string): IdentityProvider | null {
  return registry.get(id) ?? null;
}

/**
 * The providers this deployment can actually use, for the sign-in screen to
 * render. A provider that is registered but unconfigured is deliberately
 * absent: offering a button that cannot work is worse than offering nothing.
 */
export function enabledProviders(): Array<{ id: string; label: string }> {
  return [...registry.values()]
    .filter((provider) => provider.isConfigured)
    .map(({ id, label }) => ({ id, label }));
}

export type { IdentityProvider, VerifiedIdentity } from "./types";
export { googleProvider };
