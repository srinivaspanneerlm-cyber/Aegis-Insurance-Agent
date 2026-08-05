/**
 * Google Identity Services.
 *
 * The frontend gets an ID token from Google's button and posts it here; this
 * checks the signature and, critically, the audience — a token minted for some
 * other application is a valid Google token that says nothing about whether its
 * bearer meant to sign in to Aegis.
 *
 * This file is the only place in the backend that knows Google's claim names.
 */
import { OAuth2Client } from "google-auth-library";
import env from "../../config/env";
import type { IdentityProvider, VerifiedIdentity } from "./types";

// Instantiated once at module load when configured; null otherwise, so the
// provider reports itself unconfigured instead of failing per request.
const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export const googleProvider: IdentityProvider = {
  id: "google",
  label: "Google",
  isConfigured: client !== null,

  async verify(credential: string): Promise<VerifiedIdentity | null> {
    if (!client) return null;

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      payload = undefined;
    }

    // `email_verified` is not a formality. Google will issue a token for an
    // address the account holder has not proved they own, and treating that as
    // proof would let someone claim an existing Aegis account by signing up to
    // Google with its email.
    if (!payload?.sub || !payload.email || !payload.email_verified) return null;

    return {
      provider: "google",
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      displayName: payload.name ?? null,
      pictureUrl: payload.picture ?? null,
    };
  },
};

export default googleProvider;
