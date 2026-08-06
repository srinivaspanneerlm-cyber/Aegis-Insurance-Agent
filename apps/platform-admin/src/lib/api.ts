import { API_URL } from "@/lib/platform";
import type { Overview } from "@/lib/platform";

/**
 * The only place this console talks to the API.
 *
 * Mutations carry the CSRF-relevant Origin implicitly (same-origin fetch) and
 * always `credentials: "include"` — the session is an httpOnly cookie, and
 * omitting it produces a request that succeeds and is silently anonymous.
 */
export class PlatformError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PlatformError";
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
    throw new PlatformError("We could not reach Aegis.", 0, "NETWORK");
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new PlatformError(
      body.message ?? "Something went wrong.",
      response.status,
      body.code ?? "UNKNOWN"
    );
  }
  return body.data as T;
}

export const platformApi = {
  overview: () => call<Overview>("/platform/overview"),
  organizations: (search: string) =>
    call<{ total: number; organizations: OrganizationRow[] }>(
      `/platform/organizations${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  createOrganization: (body: {
    name: string;
    emailDomains?: string | undefined;
    contactEmail?: string | undefined;
    plan?: string | undefined;
    seats?: number | undefined;
  }) =>
    call<{ organization: OrganizationRow }>("/platform/organizations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setOrganizationStatus: (id: string, status: string) =>
    call<{ endedSessions: number }>(`/platform/organizations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  licences: () => call<{ licences: LicenceRow[] }>("/platform/licences"),
  identities: (realm: string, search: string) =>
    call<IdentitiesPayload>(
      `/platform/identities?${new URLSearchParams({ ...(realm ? { realm } : {}), ...(search ? { search } : {}) })}`
    ),
  roles: () => call<RolesPayload>("/platform/roles"),
  sessions: () => call<{ sessions: SessionRow[] }>("/platform/sessions"),
  settings: () => call<SettingsPayload>("/platform/settings"),
  updateSetting: (key: string, value: string) =>
    call<{ setting: SettingRow }>(`/platform/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  security: () => call<SecurityPayload>("/platform/security"),
  aiGovernance: () => call<AiGovernancePayload>("/platform/ai-governance"),
  backup: () => call<BackupPayload>("/platform/backup"),
  integrations: () => call<{ integrations: Integration[] }>("/platform/integrations"),
  /** Re-confirm the operator before a structural change. */
  stepUp: (password: string) =>
    call<{ expiresInMs: number }>("/auth/step-up", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};

export interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  emailDomains: string | null;
  contactEmail: string | null;
  createdAt: string;
  license: { plan: string; seats: number; expiresAt: string | null } | null;
  _count: { members: number };
}
export interface LicenceRow {
  organizationId: string;
  name: string;
  status: string;
  plan: string | null;
  seats: number;
  seatsUsed: number;
  expiresAt: string | null;
  expiryState: "PERPETUAL" | "EXPIRED" | "EXPIRING" | "CURRENT";
}
export interface IdentitiesPayload {
  total: number;
  byRealm: Record<string, number>;
  users: {
    id: string;
    name: string;
    email: string;
    realm: string;
    role: string;
    isActive: boolean;
    emailVerifiedAt: string | null;
    lockedUntil: string | null;
    mfaEnrolledAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    organization: { id: string; name: string } | null;
    _count: { authSessions: number };
  }[];
}
export interface RolesPayload {
  realms: string[];
  permissions: string[];
  roles: { role: string; permissions: string[]; count: number }[];
  note: string;
}
export interface SessionRow {
  id: string;
  realm: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  user: { id: string; name: string; email: string; realm: string };
}
export interface SettingRow {
  key: string;
  value: string;
  type: string;
  category: string;
  label: string;
  description: string | null;
  sensitive: boolean;
  updatedAt: string;
}
export interface SettingsPayload {
  settings: SettingRow[];
  environmentOnly: { key: string; reason: string }[];
}
export interface SecurityPayload {
  failedLoginsToday: number;
  failedLoginsThisWeek: number;
  permissionDenialsToday: number;
  accountsLockedNow: number;
  outcomes: Record<string, number>;
  recentFailures: {
    id: string;
    email: string;
    outcome: string;
    method: string;
    ipAddress: string | null;
    createdAt: string;
  }[];
  permissionDenials: {
    id: string;
    action: string;
    actorId: string | null;
    metadata: string | null;
    createdAt: string;
  }[];
  lockedAccounts: {
    id: string;
    email: string;
    realm: string;
    failedLoginAttempts: number;
    lockedUntil: string;
  }[];
}
export interface AiGovernancePayload {
  systems: {
    id: string;
    name: string;
    purpose: string;
    audience: string;
    health: string;
    activity: number | null;
    workload: number | null;
    notes: string;
    configurable: string[];
    governance: { version: null; deploymentStatus: null; tokenUsage: null; knowledgeSource: null };
  }[];
  notInstrumented: { field: string; reason: string; needs: string }[];
  changeControl: string;
}
export interface BackupPayload {
  schema: { migrationsApplied: number; latest: string | null; appliedAt: string | null };
  volumes: { users: number; organizations: number; workItems: number; auditEntries: number };
  capability: { available: false; reason: string; needs: string };
}
export interface Integration {
  id: string;
  name: string;
  purpose: string;
  configured: boolean;
  envKey: string | null;
  impact: string;
}
