/**
 * The only place this app talks to the identity API.
 *
 * Deliberately `fetch` with no client library. Every call here is a form
 * submission or a session probe; an interceptor stack would add a dependency
 * and a bundle for behaviour this app does not need — it has no long-lived
 * session to renew silently, because the moment somebody is authenticated they
 * leave for a portal.
 *
 * `credentials: "include"` on every call, because the whole point is the
 * httpOnly cookie the server sets. Without it the request succeeds and the
 * session is silently dropped.
 */
import { API_URL, type Realm } from "./identity";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  realm: string;
  emailVerifiedAt?: string | null;
  onboardedAt?: string | null;
  image?: string | null;
}

export interface SessionPayload {
  user: ApiUser;
  permissions: string[];
  realm: Realm;
  /** Where this person goes next. Decided by the server, not here. */
  portalUrl: string;
}

/**
 * A failure the interface has to react to differently.
 *
 * `code` is what separates "your password is wrong" from "you are at the wrong
 * door" from "confirm your email first" — three refusals that look identical
 * as bare 401s and need three different screens.
 */
export interface PortalOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  entitled: boolean;
  /** Present only when entitled. A closed workspace carries no destination. */
  url: string | null;
}

export interface PortalsPayload {
  realm: Realm;
  /** The one workspace this person belongs to — used for "return to my portal". */
  home: string;
  portals: PortalOption[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    // A network failure is not an authentication failure, and saying "incorrect
    // password" here would send somebody hunting for a problem they do not have.
    throw new ApiError(
      "We could not reach Aegis. Please check your connection and try again.",
      0,
      "NETWORK"
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      body.message ?? "Something went wrong. Please try again.",
      response.status,
      body.code ?? "UNKNOWN"
    );
  }

  return body.data as T;
}

export const identityApi = {
  login: (input: { email: string; password: string; realm: Realm }) =>
    call<SessionPayload>("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  register: (input: { name: string; email: string; password: string }) =>
    call<SessionPayload>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  signInWithProvider: (provider: string, credential: string, realm: Realm) =>
    call<SessionPayload>(`/auth/oauth/${provider}`, {
      method: "POST",
      body: JSON.stringify({ credential, realm }),
    }),

  /** Which provider buttons this deployment can actually offer. */
  providers: () => call<{ providers: { id: string; label: string }[] }>("/auth/providers"),

  /** Who is signed in, if anyone. A 401 here is an ordinary answer. */
  me: () => call<SessionPayload>("/auth/me"),

  requestPasswordReset: (email: string) =>
    call<void>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    call<{ endedSessions: number }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  requestEmailVerification: (email: string) =>
    call<void>("/auth/verify-email/request", { method: "POST", body: JSON.stringify({ email }) }),

  verifyEmail: (token: string) =>
    call<{ user: ApiUser }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  logout: () => call<void>("/auth/logout", { method: "POST" }),

  // ── Portal gateway ─────────────────────────────────────────────────────────

  /** Every workspace, with a URL only on the one this person may enter. */
  portals: () => call<PortalsPayload>("/auth/portals"),

  /**
   * Ask to enter a workspace.
   *
   * The destination comes back from the server; this app never assembles one.
   * That is what makes a hand-edited address bar useless — there is no URL held
   * client-side that was not granted.
   */
  enterPortal: (portalId: string) =>
    call<{ portal: string; url: string }>(`/auth/portals/${encodeURIComponent(portalId)}/enter`, {
      method: "POST",
    }),
};
