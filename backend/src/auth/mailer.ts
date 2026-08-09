/**
 * Where verification and reset emails go.
 *
 * There is no mail provider configured on this platform yet. Rather than
 * pretend otherwise, this is a delivery seam: `AUTH_MAIL_WEBHOOK_URL` turns it
 * into real delivery without a code change, and unset it writes the message to
 * the server log with a warning.
 *
 * The link is logged in development so the flow is testable end to end. In
 * production it is not — a reset link in a log file is a credential sitting in
 * a place many more people can read than the customer's inbox. There, an
 * unconfigured mailer records that a mail was owed and withholds the token.
 */
import env from "../config/env";
import { logger } from "../config/logger";

export interface AuthMail {
  readonly to: string;
  readonly kind: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORD_CHANGED";
  readonly subject: string;
  /** The full URL a person clicks. Absent for notifications. */
  readonly actionUrl?: string;
  readonly expiresAt?: Date;
}

/**
 * Send, or record that we could not.
 *
 * Never throws. A mail that fails to send must not fail the request that
 * triggered it: the account was still created, the reset was still requested,
 * and turning that into an error would leave the customer unable to retry.
 * The caller's response is identical either way — which is also what stops this
 * endpoint from becoming an account-existence oracle.
 */
export async function sendAuthMail(mail: AuthMail): Promise<void> {
  const webhook = process.env.AUTH_MAIL_WEBHOOK_URL;

  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mail),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`mail webhook responded ${response.status}`);
      return;
    } catch (error) {
      logger.error({ err: error, kind: mail.kind }, "[auth-mail] delivery failed");
      return;
    }
  }

  const isProduction = env.NODE_ENV === "production";

  logger.warn(
    {
      kind: mail.kind,
      to: mail.to,
      subject: mail.subject,
      expiresAt: mail.expiresAt?.toISOString(),
      // The token is the credential. Outside development it stays out of logs.
      actionUrl: isProduction ? "[withheld — configure AUTH_MAIL_WEBHOOK_URL]" : mail.actionUrl,
    },
    "[auth-mail] no AUTH_MAIL_WEBHOOK_URL configured; message not delivered"
  );
}

/**
 * Build the link a person clicks.
 *
 * Points at the identity application rather than the API, because the person
 * needs a page that explains what is happening — not a JSON response.
 */
export function identityUrl(path: string, params: Record<string, string> = {}): string {
  // From the validated config rather than raw process.env, so a deployment
  // that forgets it gets the documented default instead of an undefined host.
  const base = env.IDENTITY_APP_URL.replace(/\/$/, "");
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
