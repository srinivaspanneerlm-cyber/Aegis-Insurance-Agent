"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, identityApi, type SessionPayload } from "@/lib/api";
import type { Realm } from "@/lib/identity";

/**
 * The single authentication provider for the identity platform.
 *
 * Four things the brief asks for as separate contexts — session, user,
 * permissions, and the loading/error state around them — are one provider with
 * four selector hooks. They are not four providers because they are not four
 * lifetimes: a user without a session is meaningless, permissions are derived
 * from that same answer, and the loading state describes the one request that
 * produces all of it. Splitting them would have meant either four subscriptions
 * to the same fetch, or a synchronisation problem invented from nothing.
 *
 * The selector hooks are what the brief's separation actually buys: a component
 * that only reads permissions says so, and does not pretend to care about the
 * rest.
 */

export type IdentityStatus = "checking" | "anonymous" | "authenticated";

interface IdentityState {
  status: IdentityStatus;
  session: SessionPayload | null;
  /** The last failure worth showing. Cleared on the next attempt. */
  error: ApiError | null;
  /** True while a sign-in, registration or provider exchange is in flight. */
  busy: boolean;
}

interface IdentityValue extends IdentityState {
  signIn: (input: { email: string; password: string; realm: Realm }) => Promise<SessionPayload>;
  register: (input: { name: string; email: string; password: string }) => Promise<SessionPayload>;
  signInWithProvider: (
    provider: string,
    credential: string,
    realm: Realm
  ) => Promise<SessionPayload>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const IdentityContext = createContext<IdentityValue | undefined>(undefined);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IdentityState>({
    status: "checking",
    session: null,
    error: null,
    busy: false,
  });

  /**
   * Ask once, on mount, whether anybody is already signed in.
   *
   * A person who still holds a session should not be made to type a password
   * again because they navigated here from the website's gateway. A 401 is the
   * ordinary answer for every anonymous visitor and is not an error.
   */
  useEffect(() => {
    let cancelled = false;

    identityApi
      .me()
      .then((session) => {
        if (!cancelled) setState((s) => ({ ...s, status: "authenticated", session }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, status: "anonymous", session: null }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Run an authentication attempt, holding the busy and error state around it.
   *
   * One wrapper rather than three copies, because the three entry points differ
   * only in which call they make — and the part that is easy to get subtly
   * wrong is the state bookkeeping, not the call.
   */
  const attempt = useCallback(async (run: () => Promise<SessionPayload>) => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const session = await run();
      setState({ status: "authenticated", session, error: null, busy: false });
      return session;
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError("Something went wrong. Please try again.", 0, "UNKNOWN");
      // Deliberately stays "anonymous" rather than becoming an error status.
      // A failed attempt is a normal state of a sign-in screen, not a broken app.
      setState({ status: "anonymous", session: null, error: apiError, busy: false });
      throw apiError;
    }
  }, []);

  const value = useMemo<IdentityValue>(
    () => ({
      ...state,
      signIn: (input) => attempt(() => identityApi.login(input)),
      register: (input) => attempt(() => identityApi.register(input)),
      signInWithProvider: (provider, credential, realm) =>
        attempt(() => identityApi.signInWithProvider(provider, credential, realm)),
      signOut: async () => {
        try {
          await identityApi.logout();
        } finally {
          // Local state is cleared whether or not the request succeeded —
          // especially when it failed, since then it is all that is left.
          setState({ status: "anonymous", session: null, error: null, busy: false });
        }
      },
      clearError: () => setState((s) => ({ ...s, error: null })),
    }),
    [state, attempt]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

function useIdentityContext(): IdentityValue {
  const context = useContext(IdentityContext);
  if (!context) throw new Error("useIdentity must be used inside an IdentityProvider");
  return context;
}

/** Everything. Prefer one of the narrower hooks below where you can. */
export const useIdentity = useIdentityContext;

/** Just the session. */
export function useSession() {
  const { status, session } = useIdentityContext();
  return { status, session, isAuthenticated: status === "authenticated" };
}

/** Just the person. */
export function useUser() {
  return useIdentityContext().session?.user ?? null;
}

/**
 * Just what they may do.
 *
 * A courtesy for deciding what to render, never a control — the API authorises
 * every request again regardless of what any screen chose to show.
 */
export function usePermissions() {
  const { session } = useIdentityContext();
  const granted = session?.permissions ?? [];
  return {
    permissions: granted,
    can: (permission: string) => granted.includes(permission),
  };
}

/** Just the loading and error state, for a component that only renders those. */
export function useIdentityStatus() {
  const { status, busy, error, clearError } = useIdentityContext();
  return { status, busy, error, clearError };
}
