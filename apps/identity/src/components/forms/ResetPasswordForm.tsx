"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { PasswordField } from "@/components/PasswordField";
import { identityApi } from "@/lib/api";

/**
 * Choose a new password, using the token from the emailed link.
 *
 * The token stays in the URL and is never put into component state beyond
 * reading it — there is nothing to gain from copying a credential around, and
 * the page is `noindex` so it is not going anywhere a crawler will see.
 *
 * On success everybody is signed out, including whoever prompted this reset.
 * That is the point of it, and the screen says so rather than leaving somebody
 * confused about why they now have to sign in.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState<{ endedSessions: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");

    if (password !== confirmation) {
      setFailure("Those two passwords are not the same.");
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      setDone(await identityApi.resetPassword(token, password));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "We could not change that just now.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        icon="close"
        description="The address is missing the part that proves the request came from your email. Links can be truncated when they are copied by hand or wrapped by a mail client."
        footer={
          <Link
            href="/forgot-password"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-pretty text-body-sm text-content-secondary">
          Open the link directly from the email rather than retyping it, or ask for a fresh one.
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Password changed"
        icon="check"
        description="Please sign in with your new password."
        footer={
          <Link
            href="/login"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Go to sign in
          </Link>
        }
      >
        <p className="text-pretty text-body-sm text-content-secondary">
          {done.endedSessions > 0
            ? `We also signed out ${done.endedSessions} other ${done.endedSessions === 1 ? "session" : "sessions"}. If somebody else had access to your account, they no longer do.`
            : "Every other session on your account has been ended, so anybody else who was signed in no longer is."}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      icon="lock"
      description="Pick something you have not used here before. A short phrase is easier to remember and harder to guess than a jumble."
      footer={
        <Link
          href="/login"
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

        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          showStrength
          minLength={10}
        />
        <PasswordField
          label="Confirm new password"
          name="confirmation"
          autoComplete="new-password"
          hint="Type it once more so a slip does not lock you out."
        />

        <Button type="submit" size="lg" fullWidth loading={busy}>
          Change password
        </Button>

        <p className="text-pretty text-caption text-content-muted">
          Changing your password signs out every device, including this one.
        </p>
      </form>
    </AuthShell>
  );
}
