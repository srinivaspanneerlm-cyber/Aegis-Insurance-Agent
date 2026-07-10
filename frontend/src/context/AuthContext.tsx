"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "@/services/api";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
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
      } catch (err) {
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
      // Token is delivered as an httpOnly cookie by the server; nothing to store.
      const userData = res.data.user;
      setUser(userData);
      
      // Intelligent role-based redirection
      if (userData.role === "admin" || userData.role === "superadmin") {
        router.push("/admin-dashboard");
      } else {
        router.push("/consumer-dashboard");
      }
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 3) Register method — public signup always creates a standard customer.
  // Admin/superadmin roles are assigned server-side only (never requested here).
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
      
      // Intelligent role-based redirection
      if (userData.role === "admin" || userData.role === "superadmin") {
        router.push("/admin-dashboard");
      } else {
        router.push("/consumer-dashboard");
      }
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 4) Log out method — ask the server to clear the httpOnly auth cookie.
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      // Even if the request fails, drop the local session state.
    }
    setUser(null);
    router.push("/");
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin" || user?.role === "superadmin",
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
