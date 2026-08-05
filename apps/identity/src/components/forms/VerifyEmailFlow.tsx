"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { identityApi } from "@/lib/api";

type Phase = "verifying" | "verified" | "failed" | "asking" | "sent";

/**
 * Confirm an email address, or ask for a new link.
 *
 * Two screens in one because they are two ends of the same errand: somebody
 * arriving from a link, and somebody whose link has expired. Sending the second
 * group to a different page would mean a dead end at the exact moment they need
 * a way forward.
 */
export function VerifyEmailFlow({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>(token ? "verifying" : "asking");
  const [message, setMessage] = useState<string>("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  // React runs effects twice in development; without this the second run
  // presents an already-spent token and the page reports a failure that did
  // not happen.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    identityApi
      .verifyEmail(token)
      .then(() => setPhase("verified"))
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "That link is no longer valid.");
        setPhase("failed");
      });
  }, [token]);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setBusy(true);
    try {
      await identityApi.requestEmailVerification(email);
      setAddress(email);
      setPhase("sent");
    } catch {
      // The endpoint answers the same for every address, so the only failure
      // reachable here is not reaching us at all.
      setMessage("We could not send that just now. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "verifying") {
    return (
      <AuthShell title="Confirming your email" icon="mail" description="One moment.">
        {/* Announced, because there is nothing on screen for a screen reader to
            discover while this is in flight. */}
        <p role="status" className="text-center text-body-sm text-content-secondary">
          Checking that link…
        </p>
      </AuthShell>
    );
  }

  if (phase === "verified") {
    return (
      <AuthShell
        title="Email confirmed"
        icon="check"
        description="Thank you — that address is now verified."
        footer={
          <Link
            href="/login"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Continue to sign in
          </Link>
        }
      >
        <p className="text-pretty text-body-sm text-content-secondary">
          You can close this page, or sign in and carry on where you left off.
        </p>
      </AuthShell>
    );
  }

  if (phase === "sent") {
    return (
      <AuthShell
        title="Link sent"
        icon="mail"
        description={
          <>
            If <strong className="text-content">{address}</strong> needs confirming, a new link is
            on its way. It is valid for 24 hours.
          </>
        }
        footer={
          <Link
            href="/login"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <p className="text-pretty text-body-sm text-content-secondary">
          Requesting a link cancels any earlier one, so use the most recent email.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={phase === "failed" ? "That link has expired" : "Confirm your email address"}
      icon="mail"
      description={
        phase === "failed"
          ? message
          : "Tell us the address on your account and we will send a fresh confirmation link."
      }
      footer={
        <Link
          href="/login"
          className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={requestLink} noValidate className="flex flex-col gap-5">
        <Field
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@example.com"
        />
        <Button type="submit" size="lg" fullWidth loading={busy}>
          Send a new link
        </Button>
      </form>
    </AuthShell>
  );
}
