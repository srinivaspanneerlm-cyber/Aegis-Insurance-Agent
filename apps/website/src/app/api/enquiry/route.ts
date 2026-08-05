import { NextResponse } from "next/server";
import { hasErrors, validateEnquiry, type EnquiryInput } from "@/lib/enquiry";

/**
 * Where the contact and demo forms post.
 *
 * The site has no CRM behind it yet, and rather than pretend otherwise this
 * route does the parts that are real — validate, throttle, and hand the
 * enquiry to a delivery seam — then records it. `ENQUIRY_WEBHOOK_URL` turns
 * that seam into an actual delivery without a code change; unset, the enquiry
 * is written to the server log, which is honest and recoverable rather than
 * silently discarded.
 *
 * Runs on Node rather than the edge because the log is the fallback delivery
 * mechanism and needs to reach the process's stdout.
 */
export const runtime = "nodejs";

/** Bound the body before parsing it, so a large POST cannot be pushed through. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * A small per-IP throttle.
 *
 * In-process and therefore per-instance — it will not hold across a fleet, and
 * it is not trying to. It stops the obvious case (one script hammering the
 * form) without a dependency, and the note here is so nobody mistakes it for
 * infrastructure-grade rate limiting when this scales beyond one instance.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const seen = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  seen.set(key, recent);

  // Keep the map from growing without bound on a long-lived process.
  if (seen.size > 5000) {
    for (const [k, times] of seen) {
      if (times.every((at) => now - at >= WINDOW_MS)) seen.delete(k);
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

async function deliver(enquiry: EnquiryInput): Promise<void> {
  const webhook = process.env.ENQUIRY_WEBHOOK_URL;

  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enquiry),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Enquiry webhook responded ${response.status}`);
    return;
  }

  // No delivery configured. Recording it is the difference between an enquiry
  // that can be recovered from a log and one that never existed.
  // `warn` rather than `info`: an enquiry that reached a log instead of a
  // person is a degraded state, and it should read like one in the output.
  console.warn("[enquiry] no ENQUIRY_WEBHOOK_URL configured; recording instead", {
    kind: enquiry.kind,
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    company: enquiry.company,
    organizationSize: enquiry.organizationSize,
    message: enquiry.message,
    receivedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "That message is too long." }, { status: 413 });
  }

  let body: Partial<EnquiryInput>;
  try {
    body = (await request.json()) as Partial<EnquiryInput>;
  } catch {
    return NextResponse.json({ message: "We could not read that." }, { status: 400 });
  }

  // The honeypot. Answered with a success so a bot learns nothing from the
  // difference — and never delivered.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (throttled(clientKey(request))) {
    return NextResponse.json(
      { message: "That is a lot of enquiries. Please try again shortly, or email us directly." },
      { status: 429 }
    );
  }

  const errors = validateEnquiry(body);
  if (hasErrors(errors)) {
    // 422 rather than 400: the request was understood, the contents were not
    // acceptable. The client uses that distinction to decide whether to show
    // field errors or a general failure.
    return NextResponse.json({ errors }, { status: 422 });
  }

  const enquiry: EnquiryInput = {
    kind: body.kind === "demo" ? "demo" : "contact",
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    phone: body.phone ? String(body.phone).trim() : undefined,
    company: body.company ? String(body.company).trim() : undefined,
    organizationSize: body.organizationSize ? String(body.organizationSize).trim() : undefined,
    message: String(body.message).trim(),
  };

  try {
    await deliver(enquiry);
  } catch (error) {
    // The visitor is told it failed, so they can use the email address instead.
    // The reason stays server-side — it is about our infrastructure, not theirs.
    console.error("[enquiry] delivery failed", error);
    return NextResponse.json({ message: "We could not send that just now." }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
