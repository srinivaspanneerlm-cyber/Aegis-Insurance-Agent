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

/**
 * Like `call`, but keeps the pagination envelope.
 *
 * `call` returns `body.data` and discards everything beside it, which is right
 * for most endpoints. A paginated list needs the total and the page count, and
 * they sit outside `data` — so this returns both rather than changing what
 * every existing caller receives.
 */
async function callPaged<T>(path: string): Promise<{ data: T; pagination: Pagination | null }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new WorkspaceError("We could not reach Aegis.", 0, "NETWORK");
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    pagination?: Pagination;
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
  return { data: body.data as T, pagination: body.pagination ?? null };
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
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

  /**
   * The product catalogue, paginated by the server.
   *
   * `page` and `limit` are passed through rather than fetching everything and
   * slicing here — the endpoint bounds the result, and a client-side slice
   * would silently miss anything past the first page.
   */
  /**
   * The lead pipeline.
   *
   * Paginated by the server with no status filter, so the page fetches a page
   * at a time and counts the pipeline from what the server reports rather than
   * from the rows on screen.
   */
  /**
   * Platform communication reporting, over a fixed seven-day window.
   *
   * Distinct from /employee/analytics, which is this person's own caseload.
   * This one describes what the platform sent and whether it arrived.
   */
  /** This person's notification preferences. */
  /**
   * What has happened across the operation.
   *
   * Not scoped to the caller or their department — the endpoint reads every
   * work-item event there is. The page says so; a feed that looks personal and
   * is not would have people drawing conclusions about their own work from
   * somebody else's.
   */
  activity: (take = 50) =>
    call<{ events: ActivityEvent[] }>(`/communication/activity?take=${take}`),

  preferences: () => call<NotificationPreferences>("/communication/preferences"),

  /**
   * Save them.
   *
   * A partial is sent and the server fills the rest from what is stored, so a
   * screen that renders one section cannot blank another by omitting it.
   */
  savePreferences: (input: Partial<SavablePreferences>) =>
    call<NotificationPreferences>("/communication/preferences", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  communicationReport: () => call<CommunicationReport>("/communication/analytics/overview"),

  leads: (page = 1, limit = 20) =>
    callPaged<{ leads: Lead[] }>(`/leads?page=${page}&limit=${limit}`),

  /**
   * Move a lead along the pipeline.
   *
   * Only `status` is sent. PUT /leads/:id has no body validation and the
   * service spreads whatever it receives into the update, so a wider payload
   * from here would be writing columns nobody meant to expose.
   */
  updateLeadStatus: (id: string, status: LeadStatus) =>
    call<{ lead: Lead }>(`/leads/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // ── Renewal requests ─────────────────────────────────────────────────────
  //
  // A different queue from `leads` above, and deliberately so. That one is a
  // sales enquiry the platform created about a prospect; these are customers who
  // already hold cover and have asked for help with it. They share the
  // `lead.read` / `lead.write` capabilities because the authority is the same,
  // and nothing else.

  renewalRequests: (filters: RenewalQueueFilters = {}, page = 1, limit = 20) =>
    callPaged<{ leads: RenewalRequest[] }>(`/renewal-leads?${renewalQuery(filters, page, limit)}`),

  /**
   * Move a request along.
   *
   * Only the three fields the API's allow-list accepts. The record also carries
   * a userId, a consentId and the urgency the queue sorts by; sending any of
   * them would be refused, and sending them hopefully is how a client comes to
   * depend on a gap being open.
   */
  advanceRenewalRequest: (
    id: string,
    body: { status: RenewalStatus; closedReason?: ClosedReason; assignToMe?: boolean }
  ) =>
    call<{ lead: RenewalRequest }>(`/renewal-leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /**
   * Where the CSV lives.
   *
   * A URL rather than a fetch: the browser downloads it with the session cookie
   * attached, and a blob assembled here would only re-implement that badly.
   */
  renewalRequestsCsvUrl: (filters: RenewalQueueFilters = {}) =>
    `${API_URL}/renewal-leads?${renewalQuery(filters)}&format=csv`,

  policies: (page = 1, limit = 20) =>
    callPaged<{ policies: CataloguePolicy[] }>(`/policies?page=${page}&limit=${limit}`),

  /**
   * Renewals across the book, from the Sprint 9 engine.
   *
   * Distinct from the assigned queue below it: a customer whose cover expires
   * next week with no work item raised is invisible in a queue, and those are
   * precisely the ones that lapse.
   */
  renewalAnalytics: () => call<RenewalAnalytics>("/intelligence/analytics/renewals"),

  /** One document's history — every stage, and what it said. */
  document: (id: string) => call<unknown>(`/documents/${encodeURIComponent(id)}`),

  /**
   * Verify or reject a document.
   *
   * The only path to VERIFIED or REJECTED, and a rejection must carry a reason
   * — the server refuses one without. This client does not re-check that: the
   * form asks for it, and the server is what enforces it.
   */
  decideDocument: (id: string, decision: "VERIFY" | "REJECT", reason?: string) =>
    call<unknown>(`/documents/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),

  /** Unread counts by category, from the Sprint 10 platform. */
  unreadNotifications: () =>
    call<{ total: number; byCategory: Record<string, number> }>(
      "/communication/notifications/unread-count"
    ),
  /**
   * The notification list.
   *
   * `status` is passed to the server rather than filtered here: fetching
   * everything and dropping most of it client-side would make the 100-row cap
   * meaningless the moment somebody has a busy week.
   */
  notifications: (status?: NotificationStatus) =>
    call<{ notifications: EmployeeNotification[] }>(
      `/communication/notifications?take=100${status ? `&status=${status}` : ""}`
    ),

  /**
   * Raise a piece of work.
   *
   * Only `kind`, `title`, `summary`, `priority` and the customer are sent —
   * routing, the SLA and the due time are decided by the server, and a caller
   * that could set its own due time could quietly opt out of the measurement.
   */
  createWork: (input: {
    kind: string;
    title: string;
    summary?: string;
    priority?: string;
    customerId?: string | null;
  }) =>
    // The envelope is `{ item }`, not a bare work item — typing it as the latter
    // compiles and yields `undefined` for every field at runtime.
    call<{ item: WorkItem }>("/employee/work", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  markNotificationsRead: (ids: readonly string[]) =>
    call<{ updated: number }>("/communication/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  archiveNotifications: (ids: readonly string[]) =>
    call<{ updated: number }>("/communication/notifications/archive", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

export type NotificationStatus = "UNREAD" | "READ" | "ARCHIVED";

export interface EmployeeNotification {
  id: string;
  category: string;
  title: string;
  body: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: NotificationStatus;
  /** A relative portal path. Never rendered as a link without checking that. */
  deepLink: string | null;
  subjectKind: string | null;
  subjectId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface RenewalAnalytics {
  activePolicies: number;
  overdue: number;
  upcoming90Days: number;
  buckets: { within7: number; within30: number; within60: number; within90: number };
  byDomain: { domain: string; count: number }[];
  premiumAtRisk: number;
  premiumAtRiskNote: string;
  /** Declared unavailable rather than invented — nothing records outcomes. */
  renewalRate: { available: boolean; reason?: string; needs?: string };
}

export interface CataloguePolicy {
  id: string;
  policyName: string;
  premium: number;
  coverage: string;
  isActive: boolean;
  updatedAt: string;
  company: { id: string; name: string } | null;
}

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

export type LeadStatus = "pending" | "contacted" | "qualified" | "won" | "lost";

// ── Renewal requests ─────────────────────────────────────────────────────────

export type RenewalStatus = "NEW" | "CONTACTED" | "QUOTE_REQUESTED" | "PARTNER_HANDOFF" | "CLOSED";

export type ContactChannel = "CALL" | "WHATSAPP" | "EMAIL";

export type ClosedReason =
  | "RENEWED_WITH_PARTNER"
  | "RENEWED_ELSEWHERE"
  | "CUSTOMER_DECLINED"
  | "UNREACHABLE"
  | "DUPLICATE_REQUEST"
  | "NOT_ELIGIBLE";

export interface RenewalQueueFilters {
  status?: RenewalStatus | "";
  channel?: ContactChannel | "";
}

/** Only the filters that were actually chosen reach the query string. */
function renewalQuery(filters: RenewalQueueFilters, page?: number, limit?: number): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (page !== undefined) params.set("page", String(page));
  if (limit !== undefined) params.set("limit", String(limit));
  return params.toString();
}

export interface RenewalRequest {
  id: string;
  status: RenewalStatus;
  /** Already in words. The capitals are the database's business. */
  statusLabel: string;
  preferredChannel: ContactChannel;
  urgencyAtCreation: string;
  expiryAtCreation: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  closedReason: string | null;
  customer: { id: string; name: string; email: string; phone: string | null };
  policy: {
    id: string;
    insurer: string | null;
    /** Masked by the API. The full number never reaches this portal. */
    policyNumberMasked: string | null;
    registrationNumber: string | null;
    expiryDate: string | null;
  } | null;
  /** Whether a live permission still stands for the channel they chose. */
  consentActive: boolean;
}

export interface Lead {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  insuranceType: string;
  budget: string;
  status: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A metric the platform cannot honestly produce, and what it would take to. */
export interface Unavailable {
  available: false;
  reason: string;
  needs: string;
}

export interface CommunicationReport {
  windowDays: number;
  delivery: {
    attempted: number;
    succeeded: number;
    suppressed: number;
    /** Null when nothing was tried — a zero here would read as total failure. */
    successRate: number | null;
    successRateNote: string;
    suppressionReasons: { reason: string; count: number }[];
    byStatus: Record<string, number>;
    byChannel: { channel: string; counts: Record<string, number> }[];
  };
  collaboration: {
    conversationsStarted: number;
    messagesPosted: number;
    announcementsPublished: number;
  };
  unreadNotifications: number;
  engagementRate: Unavailable;
}

export interface ChannelAvailability {
  channel: string;
  available: boolean;
  /** Present only when unavailable: what is missing. */
  reason?: string;
}

export interface SavablePreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  reminderFrequency: "IMMEDIATE" | "DAILY" | "WEEKLY";
  language: string;
  mutedCategories: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface NotificationPreferences extends SavablePreferences {
  /** False when nothing has been saved yet and these are the defaults. */
  exists: boolean;
  channels: ChannelAvailability[];
}

export interface ActivityEvent {
  id: string;
  kind: string;
  summary: string;
  at: string;
  /** "Aegis" when the platform did it rather than a person. */
  actorName: string;
  workItemId: string;
  reference: string;
  department: string | null;
  deepLink: string;
}
