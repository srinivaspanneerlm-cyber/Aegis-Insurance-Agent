/**
 * Outbound mail, via Resend.
 *
 * The platform's mailer is a delivery seam: it POSTs a message as JSON to
 * whatever `AUTH_MAIL_WEBHOOK_URL` names, and knows nothing about providers.
 * This is the other end of that seam — the piece that actually sends.
 *
 * Resend is reached over its REST API rather than its SDK. One `fetch` against
 * a documented endpoint is less to keep current than a dependency, and it keeps
 * this service installable with nothing but Node.
 */
import { optionalEnv } from "./config";

/** The shape the platform's mailer sends. Nothing else is accepted. */
export interface AuthMail {
  to: string;
  kind: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORD_CHANGED";
  subject: string;
  /** The link a person clicks. Absent for notices that carry no action. */
  actionUrl?: string;
  expiresAt?: string;
}

const KINDS = new Set(["EMAIL_VERIFICATION", "PASSWORD_RESET", "PASSWORD_CHANGED"]);

export function parseAuthMail(body: unknown): AuthMail | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "A JSON object is required." };
  const m = body as Record<string, unknown>;

  if (typeof m.to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.to)) {
    return { error: "A valid recipient address is required." };
  }
  if (typeof m.kind !== "string" || !KINDS.has(m.kind)) {
    return { error: "Unknown message kind." };
  }
  if (typeof m.subject !== "string" || m.subject.trim() === "") {
    return { error: "A subject is required." };
  }
  // Only the platform's own links may be sent. Without this the relay would
  // forward any URL a caller supplied, which is a phishing service with our
  // return address on it.
  if (m.actionUrl !== undefined) {
    if (typeof m.actionUrl !== "string") return { error: "actionUrl must be a string." };
    const allowed = optionalEnv("IDENTITY_APP_URL", process.env, "http://localhost:3105");
    if (!m.actionUrl.startsWith(allowed)) {
      return { error: "actionUrl must point at the identity app." };
    }
  }

  return {
    to: m.to,
    kind: m.kind as AuthMail["kind"],
    subject: m.subject,
    ...(typeof m.actionUrl === "string" ? { actionUrl: m.actionUrl } : {}),
    ...(typeof m.expiresAt === "string" ? { expiresAt: m.expiresAt } : {}),
  };
}

const INTRO: Record<AuthMail["kind"], string> = {
  PASSWORD_RESET: "Somebody asked to set a new password for your Aegis account.",
  EMAIL_VERIFICATION: "Confirm this address to finish setting up your Aegis account.",
  PASSWORD_CHANGED: "Your Aegis password was changed.",
};

const ACTION: Record<AuthMail["kind"], string> = {
  PASSWORD_RESET: "Choose a new password",
  EMAIL_VERIFICATION: "Confirm this address",
  PASSWORD_CHANGED: "",
};

/**
 * The message body.
 *
 * Plain and short on purpose. A reset mail that looks like marketing is a reset
 * mail people distrust, and the only thing that matters here is the link and
 * how long it lasts.
 */
export function render(mail: AuthMail): { html: string; text: string } {
  const expiry = mail.expiresAt
    ? `This link stops working at ${new Date(mail.expiresAt).toUTCString()}, and can only be used once.`
    : "This link can only be used once.";
  const closing =
    mail.kind === "PASSWORD_CHANGED"
      ? "If this was not you, reset your password immediately."
      : "If you did not ask for this, you can ignore this message — nothing changes until the link is used.";

  const text = [
    INTRO[mail.kind],
    "",
    mail.actionUrl ?? "",
    "",
    mail.actionUrl ? expiry : "",
    closing,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">
  <p>${INTRO[mail.kind]}</p>
  ${
    mail.actionUrl
      ? `<p><a href="${mail.actionUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${ACTION[mail.kind]}</a></p>
  <p style="color:#555;font-size:13px">${expiry}</p>
  <p style="color:#555;font-size:13px">If the button does not work, paste this into your browser:<br><span style="word-break:break-all">${mail.actionUrl}</span></p>`
      : ""
  }
  <p style="color:#555;font-size:13px">${closing}</p>
</div>`;

  return { html, text };
}

export type SendResult = { ok: true; id: string } | { ok: false; status: number; reason: string };

/**
 * Hand the message to Resend.
 *
 * The API key is read from the environment and never logged, never returned,
 * and never written into a message. A failure reports the provider's status so
 * an operator can tell a bad key from a rejected recipient, without echoing
 * whatever the provider said back to the caller.
 */
export async function sendViaResend(mail: AuthMail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = optionalEnv("MAIL_FROM", process.env, "");

  if (!apiKey) return { ok: false, status: 503, reason: "RESEND_API_KEY is not configured." };
  if (!from) return { ok: false, status: 503, reason: "MAIL_FROM is not configured." };

  const { html, text } = render(mail);

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, status: 502, reason: "The mail provider could not be reached." };
  }

  if (!response.ok) {
    // The provider's own message can quote the request back, which would put a
    // reset link in this service's log. Only the status is recorded.
    return {
      ok: false,
      status: response.status,
      reason: `The mail provider refused the message (${response.status}).`,
    };
  }

  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: body.id ?? "accepted" };
}
