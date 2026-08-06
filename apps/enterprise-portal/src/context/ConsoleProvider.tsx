"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ACCESS_DENIED_URL, API_URL, SIGN_IN_URL } from "@/lib/console";

/**
 * The console's session, and the guard that protects it.
 *
 * The guard runs here rather than in each page, because a page-level check is
 * one somebody can forget to add on a new screen — and that failure is silent
 * and in the wrong direction. Wrapping the whole application means a new page
 * is protected because it exists, not because its author remembered.
 *
 * Deliberately simpler than the employee workspace's equivalent: there is no
 * per-person profile to fetch here. An administrator's authority comes entirely
 * from their realm and their capabilities, and inventing a profile record for
 * them would be a table nothing reads.
 */

export interface Session {
  user: { id: string; name: string; email: string; role: string; realm: string };
  permissions: string[];
  realm: string;
}

type Phase = "checking" | "ready" | "error";

interface ConsoleValue {
  phase: Phase;
  session: Session | null;
  message: string;
  can: (permission: string) => boolean;
  signOut: () => Promise<void>;
}

const ConsoleContext = createContext<ConsoleValue | undefined>(undefined);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");

  const check = useCallback(async () => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
    } catch {
      setMessage("We could not reach Aegis. Check your connection and try again.");
      setPhase("error");
      return;
    }

    if (response.status === 401) {
      // Carry where they were, so they return to it rather than to a dashboard
      // they did not ask for.
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`${SIGN_IN_URL}&next=${next}`);
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { data?: Session; message?: string };
    if (!response.ok || !body.data) {
      setMessage(body.message ?? "Something went wrong.");
      setPhase("error");
      return;
    }

    // The realm wall on the client. The API enforces it on every request too —
    // this only saves an administrator a screen full of failing panels before
    // being told they are in the wrong place.
    if (body.data.realm !== "ENTERPRISE") {
      window.location.assign(ACCESS_DENIED_URL);
      return;
    }

    setSession(body.data);
    setPhase("ready");
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const value = useMemo<ConsoleValue>(
    () => ({
      phase,
      session,
      message,
      // A courtesy for deciding what to render. The API authorises every request
      // again regardless of what any screen chose to show.
      can: (permission) => session?.permissions.includes(permission) ?? false,
      signOut: async () => {
        await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(
          () => undefined
        );
        window.location.assign(SIGN_IN_URL);
      },
    }),
    [phase, session, message]
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleValue {
  const context = useContext(ConsoleContext);
  if (!context) throw new Error("useConsole must be used inside a ConsoleProvider");
  return context;
}
