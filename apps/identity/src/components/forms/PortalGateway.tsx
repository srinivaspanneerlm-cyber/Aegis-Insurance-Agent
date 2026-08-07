"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@aegis/ui";
import { PortalCard } from "@/components/PortalCard";
import { Icon } from "@/components/Icon";
import { Wordmark } from "@/components/Wordmark";
import { useIdentity } from "@/context/IdentityProvider";
import { ApiError, identityApi, type PortalOption, type PortalsPayload } from "@/lib/api";
import { WEBSITE_URL } from "@/lib/identity";

type GatewayState =
  | { phase: "loading" }
  | { phase: "ready"; payload: PortalsPayload }
  | { phase: "expired" }
  | { phase: "offline" }
  | { phase: "error"; message: string };

/**
 * The gateway: what an authenticated person sees before entering a workspace.
 *
 * Every destination on this page came from the server. Nothing here builds a
 * portal URL, and a workspace this account cannot enter arrives with `url:
 * null` — so there is no address in the page for a tampered one to imitate, and
 * pressing Continue asks the server again rather than trusting what was
 * rendered a minute ago.
 */
export function PortalGateway() {
  const { session, signOut } = useIdentity();
  const [state, setState] = useState<GatewayState>({ phase: "loading" });
  const [entering, setEntering] = useState<string | null>(null);
  const [enterError, setEnterError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", payload: await identityApi.portals() });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setState({ phase: "error", message: "Something went wrong. Please try again." });
        return;
      }
      // A dead session and a dead network need different screens: one is
      // "sign in again", the other is "you are offline and nothing is wrong".
      if (error.status === 401) setState({ phase: "expired" });
      else if (error.code === "NETWORK") setState({ phase: "offline" });
      else setState({ phase: "error", message: error.message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back online is the moment to retry, rather than making somebody find
  // a button. Only while we are actually showing the offline screen.
  useEffect(() => {
    if (state.phase !== "offline") return;
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [state.phase, load]);

  const onContinue = useCallback(async (portal: PortalOption) => {
    setEntering(portal.id);
    setEnterError(null);
    try {
      const { url } = await identityApi.enterPortal(portal.id);
      // A full navigation: the portal is a separate application on a separate
      // origin, and the session cookie is what carries the person across.
      window.location.assign(url);
    } catch (error) {
      setEntering(null);
      if (error instanceof ApiError && error.status === 401) {
        setState({ phase: "expired" });
        return;
      }
      setEnterError(
        error instanceof ApiError ? error.message : "We could not open that workspace."
      );
    }
  }, []);

  /**
   * Enter the one workspace this account has, without asking.
   *
   * Most people belong to exactly one workspace, and presenting them a page
   * with a single card and a Continue button is asking a question that has only
   * one answer. The server already decided — this honours the decision instead
   * of restating it.
   *
   * Deliberately narrow. It fires only when precisely one portal is entitled:
   * somebody with two genuinely has a choice, and somebody with none must reach
   * the access-denied screen rather than being bounced into a redirect loop.
   *
   * `redirecting` guards against a re-render firing a second navigation while
   * the first is still in flight. `onContinue` is reused rather than
   * reimplemented, so the automatic path and the manual one make the same
   * server call and cannot drift apart.
   */
  const [autoEntering, setAutoEntering] = useState(false);

  useEffect(() => {
    if (state.phase !== "ready" || autoEntering) return;

    const entitled = state.payload.portals.filter((portal) => portal.entitled);
    if (entitled.length !== 1) return;

    const only = entitled[0];
    if (!only) return;

    setAutoEntering(true);
    void onContinue(only);
    // `onContinue` is stable (useCallback with no deps) and is intentionally
    // omitted: including it would not change when this runs, and listing it
    // implies a dependency that does not exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, autoEntering]);

  // The skeleton also covers the automatic entry, so somebody with one
  // workspace never sees a chooser flash up and vanish. From their side the
  // page simply loads and they arrive — which is the whole point.
  if (state.phase === "loading" || autoEntering) return <GatewayLoading />;

  if (state.phase === "expired") {
    return (
      <GatewayMessage
        icon="clock"
        title="Your session has ended"
        body="You will need to sign in again to choose a workspace. Nothing you saved has been lost."
        action={{ label: "Sign in again", href: "/login" }}
      />
    );
  }

  if (state.phase === "offline") {
    return (
      <GatewayMessage
        icon="refresh"
        title="You appear to be offline"
        body="We could not reach Aegis. Your session is fine — this page will retry on its own as soon as the connection is back."
        onRetry={load}
      />
    );
  }

  if (state.phase === "error") {
    return (
      <GatewayMessage
        icon="close"
        title="We could not load your workspaces"
        body={state.message}
        onRetry={load}
      />
    );
  }

  const { portals } = state.payload;
  const firstName = session?.user.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-gutter py-12 sm:py-16">
      <header className="flex flex-col items-center gap-6 text-center">
        <Wordmark />
        <div>
          <h1 className="text-balance text-display font-bold tracking-tight text-content">
            Welcome to Aegis AI
          </h1>
          <p className="mt-3 text-pretty text-body text-content-secondary sm:text-lg">
            Select the workspace you want to access.
          </p>
        </div>

        {session ? (
          <p className="text-caption text-content-muted">
            Signed in{firstName ? ` as ${firstName}` : ""} · {session.user.email}
          </p>
        ) : null}
      </header>

      {enterError ? (
        <p
          role="alert"
          className="mx-auto mt-8 max-w-2xl rounded-control bg-danger/10 px-4 py-3 text-center text-body-sm text-danger"
        >
          {enterError}
        </p>
      ) : null}

      <ul className="mt-12 grid gap-5 sm:grid-cols-2">
        {portals.map((portal) => (
          <li key={portal.id} className="flex">
            <div className="w-full">
              <PortalCard
                portal={portal}
                entering={entering === portal.id}
                busy={entering !== null}
                onContinue={onContinue}
              />
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-12 flex flex-col items-center gap-4">
        <p className="max-w-xl text-pretty text-center text-caption text-content-muted">
          Workspaces you cannot open are shown so you can see what Aegis offers. If you need access
          to one of them, the person who administers Aegis for your organisation can arrange it.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={async () => {
              await signOut();
              window.location.assign("/login");
            }}
          >
            Sign out
          </Button>
          <a
            href={WEBSITE_URL}
            className="focus-ring rounded px-3 py-2 text-body-sm text-content-secondary hover:text-content"
          >
            Back to the Aegis website
          </a>
        </div>
      </footer>
    </div>
  );
}

/**
 * The loading state is card-shaped rather than a spinner.
 *
 * The page that follows is a grid of four cards, so a skeleton of four cards
 * means nothing jumps when the answer arrives — and on a slow connection the
 * shape of what is coming is itself information.
 */
function GatewayLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-gutter py-12 sm:py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <Wordmark />
        <div className="h-10 w-72 rounded-pill bg-surface-raised/50" />
        <div className="h-5 w-56 rounded-pill bg-surface-raised/30" />
      </div>

      {/* Announced once, because a screen reader has nothing else to find here. */}
      <p role="status" className="sr-only">
        Loading your workspaces.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-56 rounded-panel border border-line/40 bg-surface-raised/20"
          >
            <div className="flex h-full flex-col p-6">
              <div className="h-12 w-12 rounded-control bg-surface-raised/50" />
              <div className="mt-5 h-5 w-40 rounded-pill bg-surface-raised/40" />
              <div className="mt-3 h-4 w-full rounded-pill bg-surface-raised/25" />
              <div className="mt-2 h-4 w-4/5 rounded-pill bg-surface-raised/25" />
              <div className="mt-auto h-12 w-full rounded-control bg-surface-raised/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GatewayMessage({
  icon,
  title,
  body,
  action,
  onRetry,
}: {
  icon: "clock" | "refresh" | "close";
  title: string;
  body: string;
  action?: { label: string; href: string };
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-panel p-8 text-center glass glass-sheen">
        <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
          <Icon name={icon} size={22} />
        </span>
        <h1 className="text-balance text-h2 font-bold tracking-tight text-content">{title}</h1>
        <p className="mt-3 text-pretty text-body-sm text-content-secondary">{body}</p>

        <div className="mt-7 flex flex-col gap-2">
          {action ? (
            <a
              href={action.href}
              className="focus-ring inline-flex h-control-lg w-full items-center justify-center rounded-control bg-brand font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
            >
              {action.label}
            </a>
          ) : null}
          {onRetry ? (
            <Button variant="secondary" size="lg" fullWidth onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
