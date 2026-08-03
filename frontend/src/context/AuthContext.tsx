"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "@/services/api";
import { useRouter } from "next/navigation";
import { purgeCustomerSession } from "@/lib/session-cleanup";
import { routeForUser } from "@/lib/authRouting";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  // 1) Verify the session on initial load. Auth now lives in an httpOnly cookie
  //    (not readable by JS), so we simply ask the server who we are.
  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await authService.getMe();
        setUser(userData.user);
      } catch {
        // No valid session cookie — treat as logged out.
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Catch authorization event error from axios client
    const handleAuthError = () => {
      setUser(null);
      router.push("/login");
    };

    window.addEventListener("aegis_auth_error", handleAuthError);
    return () => window.removeEventListener("aegis_auth_error", handleAuthError);
  }, [router]);

  // 2) Log in method
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      // The session is an httpOnly cookie set by the server; nothing to store.
      const userData = res.data.user;
      setUser(userData);
      router.push(routeForUser(userData));
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
      setUser(userData);
      // First Google sign-in has no onboardedAt, so this sends them to the
      // Executive AI welcome; a returning user goes straight to the dashboard.
      router.push(routeForUser(userData));
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
      setUser(userData);
      router.push(routeForUser(userData));
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
    setUser(data.user);
    router.push(routeForUser(data.user));
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
    setUser(null);
    router.push("/");
  };

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    completeOnboarding,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
