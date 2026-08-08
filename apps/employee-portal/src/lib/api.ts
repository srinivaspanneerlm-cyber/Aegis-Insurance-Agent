import { API_URL } from "@/lib/workspace";
import type { Analytics, KnowledgeArticle, WorkItem } from "@/lib/workspace";

/**
 * The workspace's API client.
 *
 * `credentials: "include"` on everything — the session is an httpOnly cookie,
 * and omitting it produces a request that succeeds and is silently anonymous.
 */
export class WorkspaceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "WorkspaceError";
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
    throw new WorkspaceError("We could not reach Aegis.", 0, "NETWORK");
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new WorkspaceError(
      body.message ?? "Something went wrong.",
      response.status,
      body.code ?? "UNKNOWN"
    );
  }
  return body.data as T;
}

export const workspaceApi = {
  queue: () => call<{ items: WorkItem[] }>("/employee/work"),
  workItem: (id: string) => call<unknown>(`/employee/work/${encodeURIComponent(id)}`),
  analytics: () => call<Analytics>("/employee/analytics"),
  knowledge: (q: string, category?: string) =>
    call<{ articles: KnowledgeArticle[] }>(
      `/employee/knowledge?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`
    ),
  workflows: () => call<{ definitions: WorkflowDefinitionView[] }>("/employee/workflows"),
  escalations: () => call<{ escalations: Escalation[] }>("/employee/escalations"),

  /**
   * The verification queue, from the Sprint 8 document platform.
   *
   * The documents page reached this with a raw `fetch`. Routing it through the
   * client means one place handles the session cookie and the error envelope,
   * and a caller cannot forget either.
   */
  documentQueue: () => call<{ waiting: number; documents: unknown[] }>("/documents/queue/pending"),

  /**
   * Customers this advisor may look up.
   *
   * Deliberately thin — name, email and whether a profile exists. The server
   * decides who is visible; the term is a filter, not an authorisation.
   */
  customers: (search?: string) =>
    call<{ customers: CustomerRow[] }>(
      `/intelligence/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),

  /** One customer's protection analysis, for the conversation about to happen. */
  customerReport: (userId: string) =>
    call<unknown>(`/intelligence/report?userId=${encodeURIComponent(userId)}`),

  /**
   * Everything an advisor needs before speaking to a customer, in one call.
   *
   * Behind `customer.read` and audited, because it is one person's file rather
   * than a business metric. It carries the same reasoning the customer will see,
   * so a phone call is a conversation rather than a translation.
   */
  customerBrief: (userId: string) =>
    call<CustomerBrief>(`/intelligence/customer/${encodeURIComponent(userId)}/brief`),

  /** Unread counts by category, from the Sprint 10 platform. */
  unreadNotifications: () =>
    call<{ total: number; byCategory: Record<string, number> }>(
      "/communication/notifications/unread-count"
    ),
};

export interface CustomerBrief {
  customer: { id: string; name: string; email: string; realm: string; createdAt: string };
  profileCompleteness: number;
  openWith: { summary: string; domain: string | null; rationale: string };
  lifeStage: { stage: string; narrative: string };
  suggestedPolicies: {
    domain: string;
    label: string;
    headline: string;
    urgency: string;
    why: string;
    talkingPoints: string[];
    limitations: string[];
    confidence: number;
  }[];
  risk: { overall: string; narrative: string; raised: { dimension: string }[]; unknown: string[] };
  missingDocuments: { documentKey: string; label: string }[];
  documentsBlocked: boolean;
  /** Declared unavailable rather than fabricated — no claims system is connected. */
  claimObservations: { available: boolean; reason?: string; needs?: string };
  askAbout: string[];
}

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  profileCompleteness: number;
  hasProfile: boolean;
}

export interface WorkflowDefinitionView {
  definition: string;
  label: string;
  kind: string;
  steps: {
    key: string;
    name: string;
    description: string;
    actorKind: "SYSTEM" | "ASSISTANT" | "EMPLOYEE";
    requiresDecision: boolean;
  }[];
}

export interface Escalation {
  workItemId: string;
  reason: string;
  detail: string;
}
