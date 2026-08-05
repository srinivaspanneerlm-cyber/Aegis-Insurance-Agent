"use client";

import Link from "next/link";
import { useEffect, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { PasswordField } from "@/components/PasswordField";
import { useIdentity } from "@/context/IdentityProvider";
import { REALM_PRESENTATION, type Realm } from "@/lib/identity";

/**
 * Create a customer account.
 *
 * Only the customer realm reaches this screen. Staff accounts are provisioned
 * by somebody who already holds the authority to provision them — a
 * self-registration path into a staff realm would make a form the only barrier
 * between the public and other people's records.
 */
/**
 * Authentication no longer jumps straight to a portal.
 *
 * Everybody lands on the gateway, which asks the server which workspaces they
 * may enter. Sending them directly would mean this app deciding a destination
 * from a value it was handed — and it is the server's job to decide, and to
 * record, which door somebody went through.
 */
const GATEWAY_PATH = "/gateway";

export function RegisterForm({ realm }: { realm: Realm }) {
  const presentation = REALM_PRESENTATION[realm];
  const { register, busy, error, clearError, status, session } = useIdentity();

  useEffect(() => {
    if (status === "authenticated" && session) window.location.assign(GATEWAY_PATH);
  }, [status, session]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await register({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      window.location.assign(GATEWAY_PATH);
    } catch {
      /* the provider holds the error */
    }
  }

  if (!presentation.allowsRegistration) {
    return (
      <AuthShell
        eyebrow={presentation.audience}
        title="Accounts here are issued, not created"
        description={presentation.provisioningNote}
        icon="lock"
        footer={
          <Link
            href={`/login?portal=${realm}`}
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <p className="text-pretty text-body-sm text-content-secondary">
          If you should have access to the {presentation.label.toLowerCase()} portal and do not, the
          person who administers it for your organisation can arrange it.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      width="wide"
      eyebrow="For individuals and families"
      title="Create your Aegis account"
      description="You do not need an account to read and compare cover. One keeps your documents and progress for next time."
      icon="users"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error ? (
          <div
            role="alert"
            className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger"
          >
            {error.message}
          </div>
        ) : null}

        <Field
          label="Your name"
          name="name"
          required
          autoComplete="name"
          placeholder="Priya Raman"
        />
        <Field
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@example.com"
          hint="We will send a link to confirm it is yours."
        />
        <PasswordField
          label="Choose a password"
          name="password"
          autoComplete="new-password"
          showStrength
          minLength={10}
        />

        <Button type="submit" size="lg" fullWidth loading={busy} onClick={clearError}>
          Create account
        </Button>

        <p className="text-pretty text-caption text-content-muted">
          By creating an account you agree that we may hold the details you give us in order to
          explain and compare cover for you.
        </p>
      </form>
    </AuthShell>
  );
}
