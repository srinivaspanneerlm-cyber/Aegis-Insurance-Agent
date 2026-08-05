"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authService } from "@/services/api";
import { useRouter, usePathname } from "next/navigation";
import { purgeCustomerSession } from "@/lib/session-cleanup";
import { destinationForCurrentUrl as destinationFor } from "@/lib/authRouting";
import { LOGIN_ROUTE, isProtectedPath } from "@/lib/routes";
import { publishSessionEvent, subscribeToSessionEvents } from "@/lib/session-broadcast";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import SessionExpiryDialog from "@/components/SessionExpiryDialog";
import { hasPermission, type Permission } from "@/lib/permissions";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  /** Profile picture from the identity provider (Google). */
  image?: string | null;
  lastLoginAt?: string | null;
  /** Null until first-time onboarding is finished — this is what routes them. */
  onboardedAt?: string | null;
  preferredLanguage?: string | null;
  /** JSON array string as stored; parsed by whoever needs it. */
  insuranceInterests?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Finish first-time onboarding and continue to the dashboard. */
  completeOnboarding: (input: {
    preferredLanguage: string;
    insuranceInterests: string[];
  }) => Promise<void>;
  isAuthenticated: boolean;
  /**
   * Capabilities the API resolved for this session. Empty for a customer, and
   * empty while the boot probe is still running.
   */
  permissions: readonly string[];
  /**
   * Whether to *render* something. Never whether to allow it — the API decides
   * that again on every request. See `lib/permissions.ts`.
   */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // A session is a person *and* what they may do, so the two are always set
  // together. Kept as one call because a path that updated only the user would
  // leave the previous person's capabilities on screen — on a shared device,
  // for the next customer.
  const adoptSession = useCallback(
    (nextUser: User, granted?: readonly string[]) => {
      setUser(nextUser);
      setPermissions(granted ?? []);
    },
    []
  );

  const clearSession = useCallback(() => {
    setUser(null);
    setPermissions([]);
  }, []);

  // Read inside listeners that must not be re-bound on every navigation.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 1) Verify the session on initial load. Auth now lives in an httpOnly cookie
  //    (not readable by JS), so we simply ask the server who we are.
  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await authService.getMe();
        adoptSession(userData.user, userData.permissions);
      } catch {
        // No valid session cookie — treat as logged out.
        clearSession();
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // The API reports a session that has genuinely ended — the access token
    // could not be renewed. By the time this fires the customer has already
    // lost the page they were on, so `replace` keeps Back from returning them
    // to it.
    const handleAuthError = () => {
      clearSession();
      router.replace(LOGIN_ROUTE);
    };

    window.addEventListener("aegis_auth_error", handleAuthError);
    return () => window.removeEventListener("aegis_auth_error", handleAuthError);
  }, [router, adoptSession, clearSession]);

  // 1b) Keep this tab in step with the customer's other tabs.
  //
  //     Comparing two policies means two tabs, so a session change in one of
  //     them is a session change in all of them. A tab that missed the news
  //     would keep a dashboard full of personal detail on screen with no
  //     session behind it — on a shared device, for the next person to read.
  useEffect(() => {
    return subscribeToSessionEvents((event) => {
      if (event.type === "signed-out") {
        purgeCustomerSession();
        clearSession();
        // Only move them if they are somewhere that needs a session. A tab left
        // on the home page or mid-conversation with the advisor has every right
        // to stay where it is.
        if (isProtectedPath(pathnameRef.current ?? "")) router.replace(LOGIN_ROUTE);
        return;
      }

      // Signed in elsewhere: adopt the session rather than keep insisting they
      // are a stranger. The cookie is already set for this tab too — this only
      // catches up the state that decides what is rendered.
      authService
        .getMe()
        .then((data) => adoptSession(data.user, data.permissions))
        .catch(() => {
          // The session went away between the announcement and this question.
          // The next request will settle it; nothing to do here.
        });
    });
  }, [router, adoptSession, clearSession]);

  // 2) Log in method
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      // The session is an httpOnly cookie set by the server; nothing to store.
      const userData = res.data.user;
      adoptSession(userData, res.data.permissions);
      publishSessionEvent({ type: "signed-in" });
      router.push(destinationFor(userData));
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 2b) Google sign-in — exchange the Google ID token (credential) for our own
  //     httpOnly session. New Google accounts are created server-side as
  //     customers, so this path is always a consumer login.
  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const res = await authService.googleLogin(credential);
      const userData = res.data.user;
      adoptSession(userData, res.data.permissions);
      publishSessionEvent({ type: "signed-in" });
      // First Google sign-in has no onboardedAt, so this sends them to the
      // Executive AI welcome; a returning user goes straight to the dashboard.
      router.push(destinationFor(userData));
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 3) Register method — public signup always creates a standard customer.
  // Roles are assigned server-side only and are never requested from here.
  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authService.register({
        name,
        email,
        password,
      });
      // Token is delivered as an httpOnly cookie by the server; nothing to store.
      const userData = res.data.user;
      adoptSession(userData, res.data.permissions);
      publishSessionEvent({ type: "signed-in" });
      router.push(destinationFor(userData));
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 3b) Finish onboarding — the server stamps `onboardedAt`, and we replace the
  //     local user with what it returns so the routing rule stops sending them
  //     back here.
  const completeOnboarding = async (input: {
    preferredLanguage: string;
    insuranceInterests: string[];
  }) => {
    const data = await authService.completeOnboarding(input);
    // Onboarding answers language and interests, never the role — so the
    // capabilities already in hand still stand.
    setUser(data.user);
    router.push(destinationFor(data.user));
  };

  // 4) Log out method — ask the server to clear the httpOnly auth cookie.
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the request fails, drop the local session state.
    }
    // Purge before dropping the user: the browser holds the customer's KYC
    // progress, their advisor transcripts, and a session id that would resume
    // their conversation server-side. Runs even when the request above failed
    // — especially then, since the local copy is all that's left.
    purgeCustomerSession();
    // Tell the other tabs before this one navigates away: leaving a signed-out
    // customer's dashboard rendered in a second tab is the whole problem.
    publishSessionEvent({ type: "signed-out" });
    clearSession();
    router.push("/");
  };

  // 5) The unattended session — see `useIdleTimeout`.
  //
  //    Ends the same way an explicit logout does, but lands on the sign-in page
  //    carrying where they were, so "Stay signed in" arriving thirty seconds
  //    too late still costs them only a password.
  const endIdleSession = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Same reasoning as logout: the local purge matters most when the request
      // is the thing that failed.
    }
    purgeCustomerSession();
    publishSessionEvent({ type: "signed-out" });
    clearSession();
    const returnTo = pathnameRef.current;
    router.replace(
      returnTo && isProtectedPath(returnTo)
        ? `${LOGIN_ROUTE}?next=${encodeURIComponent(returnTo)}`
        : LOGIN_ROUTE
    );
  }, [router, clearSession]);

  // Only where a session is actually exposed. The public advisor is never
  // interrupted — an anonymous visitor mid-conversation has no session to
  // protect, and cutting them off would cost us the customer.
  const idleEnabled = !!user && isProtectedPath(pathname ?? "");
  const idle = useIdleTimeout({ enabled: idleEnabled, onExpire: endIdleSession });

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    completeOnboarding,
    isAuthenticated: !!user,
    permissions,
    can: (permission: Permission) => hasPermission(permissions, permission),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiryDialog
        open={idleEnabled && idle.phase === "warning"}
        msUntilSignOut={idle.msUntilSignOut}
        onStaySignedIn={idle.extend}
        onSignOut={logout}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
