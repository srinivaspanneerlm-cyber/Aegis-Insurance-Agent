"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ACCESS_DENIED_URL,
  API_URL,
  SIGN_IN_URL,
  type EmployeeProfile,
  type Workload,
} from "@/lib/workspace";

/**
 * The workspace's session, and the guard that protects it.
 *
 * The guard runs here rather than in each page for one reason: a page-level
 * check is a check somebody can forget to add, and the failure is silent and in
 * the wrong direction. One provider wrapping the whole application means a new
 * screen is protected because it exists, not because its author remembered.
 *
 * Three outcomes, and they are genuinely different:
 *
 *  - **No session** → the identity platform's sign-in, carrying where they were.
 *  - **Wrong realm** → the identity platform's 403. A customer who reached this
 *    URL is not helped by a login form; they are already signed in.
 *  - **No profile** → stay here and say so. They are the right kind of person
 *    and somebody has not finished provisioning them, which is a message, not a
 *    redirect.
 */

export interface Session {
  user: { id: string; name: string; email: string; role: string; realm: string };
  permissions: string[];
  realm: string;
}

type Phase = "checking" | "ready" | "no-profile" | "error";

interface WorkspaceValue {
  phase: Phase;
  session: Session | null;
  profile: EmployeeProfile | null;
  workload: Workload | null;
  message: string;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | undefined>(undefined);

async function apiGet<T>(
  path: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "We could not reach Aegis." };
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      code: body.code ?? "UNKNOWN",
      message: body.message ?? "Something went wrong.",
    };
  }
  return { ok: true, data: body.data as T };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [message, setMessage] = useState("");

  const check = useCallback(async () => {
    const me = await apiGet<Session>("/auth/me");

    if (!me.ok) {
      if (me.status === 401) {
        // Carry where they were, so they come back to it rather than to a
        // dashboard they did not ask for.
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`${SIGN_IN_URL}&next=${next}`);
        return;
      }
      setMessage(me.message);
      setPhase("error");
      return;
    }

    // The realm wall on the client. The API enforces it too — this only saves
    // somebody a screen full of failing requests before being told.
    if (me.data.realm !== "EMPLOYEE") {
      window.location.assign(ACCESS_DENIED_URL);
      return;
    }

    setSession(me.data);

    const employee = await apiGet<{ profile: EmployeeProfile; workload: Workload }>("/employee/me");
    if (!employee.ok) {
      setMessage(employee.message);
      setPhase(employee.code === "NO_EMPLOYEE_PROFILE" ? "no-profile" : "error");
      return;
    }

    setProfile(employee.data.profile);
    setWorkload(employee.data.workload);
    setPhase("ready");
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      phase,
      session,
      profile,
      workload,
      message,
      // A courtesy for deciding what to render. The API authorises every request
      // again regardless of what any screen chose to show.
      can: (permission) => session?.permissions.includes(permission) ?? false,
      refresh: check,
      signOut: async () => {
        await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(
          () => undefined
        );
        window.location.assign(SIGN_IN_URL);
      },
    }),
    [phase, session, profile, workload, message, check]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return context;
}

/** Just what they may do, for a component that only renders on capability. */
export function usePermissions() {
  const { can, session } = useWorkspace();
  return { can, permissions: session?.permissions ?? [] };
}
