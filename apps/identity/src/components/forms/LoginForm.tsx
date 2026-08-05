"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { PasswordField } from "@/components/PasswordField";
import { Icon } from "@/components/Icon";
import { useIdentity } from "@/context/IdentityProvider";
import { REALM_PRESENTATION, type Realm } from "@/lib/identity";
import { identityApi } from "@/lib/api";

/**
 * The interactive half of the sign-in screen.
 *
 * The realm arrives as a prop from the server component rather than being read
 * from `useSearchParams` here. That is not a style preference: reading search
 * params inside a client component opts the whole subtree out of prerendering,
 * and the page was serving an empty document — a sign-in form that only exists
 * once JavaScript has run. Now the markup is in the response and this only adds
 * behaviour to it.
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

export function LoginForm({ realm, next }: { realm: Realm; next: string | null }) {
  const presentation = REALM_PRESENTATION[realm];

  const { signIn, busy, error, clearError, status, session } = useIdentity();
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);

  // Somebody who still holds a session should not be made to type a password
  // again because they arrived from the website's gateway.
  useEffect(() => {
    if (status === "authenticated" && session) {
      window.location.assign(GATEWAY_PATH);
    }
  }, [status, session, next]);

  useEffect(() => {
    if (!presentation.allowsProvider) return;
    identityApi
      .providers()
      .then((data) => setProviders(data.providers))
      .catch(() => setProviders([]));
  }, [presentation.allowsProvider]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      await signIn({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        realm,
      });
      // A full navigation rather than a router push, so the gateway loads with
      // the freshly set session cookie already in place.
      window.location.assign(
        next ? `${GATEWAY_PATH}?next=${encodeURIComponent(next)}` : GATEWAY_PATH
      );
    } catch {
      // The provider already holds the error; nothing to add here.
    }
  }

  // Three refusals that are all 401/403 on the wire and need three different
  // things said about them. Anything else is the generic message.
  const wrongRealm = error?.code === "WRONG_REALM";
  const unverified = error?.code === "EMAIL_NOT_VERIFIED";
  const locked = error?.code === "ACCOUNT_LOCKED";

  return (
    <AuthShell
      eyebrow={presentation.audience}
      title={`Sign in to ${presentation.label.toLowerCase() === "customer" ? "Aegis" : presentation.label}`}
      description={presentation.blurb}
      icon="lock"
      footer={
        presentation.allowsRegistration ? (
          <>
            New to Aegis?{" "}
            <Link
              href={`/register?portal=${realm}`}
              className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
            >
              Create an account
            </Link>
          </>
        ) : (
          <span className="text-content-muted">{presentation.provisioningNote}</span>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error ? (
          <div
            role="alert"
            className={
              wrongRealm || unverified
                ? "flex flex-col gap-2 rounded-control border border-warning/40 bg-warning/10 px-4 py-3 text-body-sm text-content"
                : "rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger"
            }
          >
            <span>{error.message}</span>
            {wrongRealm ? (
              <Link
                href="/"
                className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
              >
                Choose the right portal
              </Link>
            ) : null}
            {unverified ? (
              <Link
                href="/verify-email"
                className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
              >
                Resend the confirmation link
              </Link>
            ) : null}
            {locked ? (
              <Link
                href="/forgot-password"
                className="focus-ring rounded font-semibold text-brand underline underline-offset-4"
              >
                Reset your password instead
              </Link>
            ) : null}
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

        <div className="flex flex-col gap-2">
          <PasswordField label="Password" name="password" autoComplete="current-password" />
          <Link
            href={`/forgot-password?portal=${realm}`}
            className="focus-ring self-end rounded text-caption text-content-secondary hover:text-content"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={busy} onClick={clearError}>
          Sign in
        </Button>
      </form>

      {presentation.allowsProvider && providers.length > 0 ? (
        <>
          <div className="my-6 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-line/50" />
            <span className="text-caption text-content-muted">or</span>
            <span className="h-px flex-1 bg-line/50" />
          </div>

          <div className="flex flex-col gap-2">
            {providers.map((provider) => (
              <ProviderButton key={provider.id} provider={provider} realm={realm} />
            ))}
          </div>
        </>
      ) : null}

      {!presentation.allowsProvider ? (
        <p className="mt-6 flex items-start gap-2 text-caption text-content-muted">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
          <span>Provider sign-in is deliberately not offered for this portal.</span>
        </p>
      ) : null}
    </AuthShell>
  );
}

/**
 * A provider button.
 *
 * Rendered from the server's list rather than hardcoded, so a deployment
 * without Google keys shows no Google button instead of one that fails. The
 * exchange itself is not wired here: Google Identity Services issues the
 * credential in the portal's own flow, and this hands off to it — see the
 * README for what remains.
 */
function ProviderButton({
  provider,
  realm,
}: {
  provider: { id: string; label: string };
  realm: string;
}) {
  return (
    <a
      href={`/oauth/${provider.id}?portal=${realm}`}
      className="focus-ring inline-flex h-control-lg w-full items-center justify-center gap-2.5 rounded-control border border-line/60 bg-surface-raised/40 text-body font-medium text-content transition-colors duration-fast hover:border-line"
    >
      <Icon name="spark" size={18} />
      Continue with {provider.label}
    </a>
  );
}
