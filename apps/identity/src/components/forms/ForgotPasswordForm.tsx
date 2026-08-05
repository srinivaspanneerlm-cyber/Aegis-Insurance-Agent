"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { identityApi } from "@/lib/api";
import type { Realm } from "@/lib/identity";

/**
 * Ask for a reset link.
 *
 * The confirmation is deliberately identical whether or not we hold an account
 * for that address — matching what the API does. A screen that said "no such
 * account" would turn this form into a list of who banks with us, which is
 * worth far more to an attacker than the reset itself.
 */
export function ForgotPasswordForm({ realm }: { realm: Realm }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setBusy(true);
    setFailure(null);
    try {
      await identityApi.requestPasswordReset(email);
      setAddress(email);
      setSent(true);
    } catch (error) {
      // Only a genuine failure to reach us shows here. An unknown address is
      // not an error and must not look like one.
      setFailure(error instanceof Error ? error.message : "We could not send that just now.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        icon="mail"
        description={
          <>
            If we have an account for <strong className="text-content">{address}</strong>, a reset
            link is on its way. It is valid for one hour.
          </>
        }
        footer={
          <Link
            href={`/login?portal=${realm}`}
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-pretty text-body-sm text-content-secondary">
            The link opens a page where you choose a new password. Requesting another link
            immediately cancels this one, so use the most recent email you received.
          </p>
          <p className="flex items-start gap-2 text-caption text-content-muted">
            <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
            <span>
              Nothing arrived? Check the spam folder, then try again — the address may be spelled
              differently from the one on the account.
            </span>
          </p>
          <Button variant="secondary" size="md" fullWidth onClick={() => setSent(false)}>
            Use a different address
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      icon="refresh"
      description="Tell us the address on your account and we will send a link to choose a new password."
      footer={
        <Link
          href={`/login?portal=${realm}`}
          className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {failure ? (
          <div
            role="alert"
            className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger"
          >
            {failure}
          </div>
        ) : null}

        <Field
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@example.com"
        />

        <Button type="submit" size="lg" fullWidth loading={busy}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
