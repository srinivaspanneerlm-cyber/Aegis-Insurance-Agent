/**
 * One-time proofs: email verification and password reset.
 *
 * The same mechanism with different consequences, so it is one module rather
 * than two that would drift apart on the things that must not differ — expiry,
 * single use, and the fact that only a hash is ever stored.
 *
 * That last point is the one worth being loud about. A reset table holding raw
 * tokens is a table of live account takeovers: anyone who can read the database
 * — a backup, a log, a support query — can become any user. Hashing means a
 * stolen table is worthless, exactly as it is for refresh tokens.
 */
import crypto from "crypto";
import { verificationTokenRepository } from "../repositories";
import { auditService } from "../services/audit.service";

export const VERIFICATION_PURPOSES = ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];

/**
 * How long each kind of proof lives.
 *
 * A reset link is short because it is the more dangerous of the two — it grants
 * control of the account, and the window in which a forwarded or intercepted
 * email is useful should be small. Verification is longer because failing it
 * costs nothing but a second email, and people read their inbox on their own
 * schedule.
 */
export const TOKEN_TTL_MS: Record<VerificationPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60_000,
  PASSWORD_RESET: 60 * 60_000,
};

const hash = (raw: string): string => crypto.createHash("sha256").update(raw).digest("hex");

export interface IssuedToken {
  /** The raw value. Goes in the link and is never stored. */
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Mint a proof and persist only its hash.
 *
 * Any outstanding token of the same purpose is retired first, so asking for a
 * second reset link disables the first. Without that, every link ever sent
 * stays live until it expires — and an old forwarded email becomes a working
 * takeover.
 */
export async function issueToken(
  userId: string,
  email: string,
  purpose: VerificationPurpose
): Promise<IssuedToken> {
  await verificationTokenRepository.consumeOutstanding(userId, purpose);

  // 32 bytes of CSPRNG output. base64url so it survives being pasted out of a
  // mail client that has helpfully wrapped the line.
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await verificationTokenRepository.create({
    tokenHash: hash(token),
    userId,
    email: email.toLowerCase().trim(),
    purpose,
    expiresAt,
  });

  return { token, expiresAt };
}

export type ConsumeResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" | "WRONG_PURPOSE" | "EMAIL_CHANGED" };

/**
 * Spend a proof, once.
 *
 * `currentEmail` is compared against the address the token was issued for. A
 * reset link must stop working if the account's address changed in between —
 * otherwise a link sent to an old address still controls the account after the
 * customer has moved away from it.
 *
 * The caller decides what to tell the user. Every failure reason here maps to
 * the same message on the wire; they are distinguished so the audit trail can
 * tell a stale link from an attack.
 */
export async function consumeToken(
  rawToken: string,
  purpose: VerificationPurpose,
  currentEmail?: string
): Promise<ConsumeResult> {
  const record = await verificationTokenRepository.findByHash(hash(rawToken));

  if (!record) return { ok: false, reason: "INVALID" };
  if (record.purpose !== purpose) {
    // A verification token presented at the reset endpoint, or the reverse.
    // Worth recording: it does not happen by accident.
    auditService.record({
      actorId: record.userId,
      action: "auth.token.wrong_purpose",
      metadata: { issuedFor: record.purpose, presentedAt: purpose },
    });
    return { ok: false, reason: "WRONG_PURPOSE" };
  }
  if (record.consumedAt) {
    auditService.record({ actorId: record.userId, action: "auth.token.reused", metadata: { purpose } });
    return { ok: false, reason: "USED" };
  }
  if (record.expiresAt <= new Date()) return { ok: false, reason: "EXPIRED" };

  if (currentEmail && record.email !== currentEmail.toLowerCase().trim()) {
    auditService.record({
      actorId: record.userId,
      action: "auth.token.email_changed",
      metadata: { purpose },
    });
    return { ok: false, reason: "EMAIL_CHANGED" };
  }

  await verificationTokenRepository.consume(record.id);
  return { ok: true, userId: record.userId, email: record.email };
}
