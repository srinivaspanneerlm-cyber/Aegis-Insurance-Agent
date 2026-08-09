import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import crypto from "node:crypto";
import { optionalEnv } from "./config";
import { parseAuthMail, sendViaResend } from "./mail";

/**
 * @aegis/notification-service
 *
 * Consumes platform events and delivers email/SMS/push. A consumer, not a peer:
 * nothing calls it synchronously, so a slow provider can never make issuing a
 * policy slow.
 *
 * It now carries its first real handler. The platform's mailer is a delivery
 * seam — it POSTs a message to whatever `AUTH_MAIL_WEBHOOK_URL` names and knows
 * nothing about providers — and `POST /auth-mail` here is the other end of it.
 * Point the backend at this service and verification and reset mail starts
 * arriving; point it elsewhere and this service is simply unused.
 */

const PORT = Number(optionalEnv("PORT", process.env, "4002"));

/**
 * The shared secret, if one is set.
 *
 * An unauthenticated relay that sends mail from your domain is a phishing
 * service with your return address on it. The backend sends this header when it
 * has the same value; a relay with no secret configured accepts anything, which
 * is fine bound to localhost and is not fine anywhere else — so it says so at
 * startup.
 */
const SECRET = process.env.AUTH_MAIL_WEBHOOK_SECRET ?? "";

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Constant-time compare, so a wrong secret cannot be found a byte at a time. */
function secretMatches(presented: string | undefined): boolean {
  if (!SECRET) return true;
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = createServer((req, res) => {
  // Liveness only. A readiness probe must also check the dependencies this
  // service cannot work without, and it gains those when it gains them.
  if (req.url === "/health") {
    json(res, 200, {
      status: "ok",
      service: "@aegis/notification-service",
      // Enough for an operator to see why nothing is arriving, without
      // disclosing the key itself.
      mail: {
        provider: "resend",
        configured: Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.MAIL_FROM),
        authenticated: Boolean(SECRET),
      },
    });
    return;
  }

  if (req.url === "/auth-mail" && req.method === "POST") {
    if (!secretMatches(req.headers["x-webhook-secret"] as string | undefined)) {
      json(res, 401, { status: "error", code: "UNAUTHORIZED" });
      return;
    }

    let raw = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      raw += chunk;
      // A mail message is small. Anything larger is not one.
      if (raw.length > 16_384) {
        tooLarge = true;
        req.destroy();
      }
    });

    req.on("end", () => {
      if (tooLarge) return;

      let body: unknown;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        json(res, 400, { status: "error", code: "INVALID_JSON" });
        return;
      }

      const parsed = parseAuthMail(body);
      if ("error" in parsed) {
        json(res, 400, { status: "error", code: "INVALID_MESSAGE", message: parsed.error });
        return;
      }

      void sendViaResend(parsed).then((result) => {
        if (result.ok) {
          // The recipient and kind are worth recording. The link is not — it
          // carries a single-use credential, and a log is not an inbox.
          console.warn(`[notification-service] sent ${parsed.kind} to ${parsed.to} (${result.id})`);
          json(res, 202, { status: "accepted", id: result.id });
          return;
        }
        console.error(
          `[notification-service] ${parsed.kind} to ${parsed.to} failed: ${result.reason}`
        );
        json(res, result.status, { status: "error", message: result.reason });
      });
    });
    return;
  }

  json(res, 404, { status: "error", code: "NOT_FOUND" });
});

server.listen(PORT, () => {
  console.warn(`[notification-service] listening on :${PORT}`);
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    console.warn(
      "[notification-service] RESEND_API_KEY or MAIL_FROM is unset — /auth-mail will refuse with 503 until both are set."
    );
  }
  if (!SECRET) {
    console.warn(
      "[notification-service] AUTH_MAIL_WEBHOOK_SECRET is unset — this relay accepts unauthenticated requests. Set it before exposing this service beyond localhost."
    );
  }
});
