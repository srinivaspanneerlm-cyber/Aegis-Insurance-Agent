import { API_URL } from "@/lib/console";
import type {
  AiSystem,
  ComplianceFinding,
  ComplianceSummary,
  DashboardPayload,
} from "@/lib/console";

/** The only place this console talks to the API. */
export class ConsoleError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ConsoleError";
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ConsoleError("We could not reach Aegis.", 0, "NETWORK");
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ConsoleError(
      body.message ?? "Something went wrong.",
      response.status,
      body.code ?? "UNKNOWN"
    );
  }
  return body.data as T;
}

export const consoleApi = {
  dashboard: () => call<DashboardPayload>("/enterprise/dashboard"),

  /** The tenant's own record. Read-only — the platform operator owns these fields. */
  organization: () => call<OrganizationPayload>("/enterprise/organization"),
  analytics: () =>
    call<{
      overview: DashboardPayload["overview"];
      trend: DashboardPayload["trend"];
      branches: DashboardPayload["branches"];
    }>("/enterprise/analytics"),
  customers: (search: string) =>
    call<{ total: number; customers: CustomerRow[] }>(
      `/enterprise/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  /** One customer's operational record. No conversation content, by design. */
  customer: (id: string) => call<CustomerDetail>(`/enterprise/customers/${encodeURIComponent(id)}`),

  /** The workforce. `department` is filtered by the server, not here. */
  employees: (department?: string) =>
    call<{ employees: EmployeeRow[]; departments: { department: string; count: number }[] }>(
      `/enterprise/employees${department ? `?department=${encodeURIComponent(department)}` : ""}`
    ),
  products: () => call<ProductsPayload>("/enterprise/products"),

  renewals: () => call<RenewalsPayload>("/enterprise/renewals"),
  documents: () => call<DocumentsPayload>("/enterprise/documents"),

  /** The book of policies customers hold. Distinct from the catalogue above. */
  policies: (status?: string) =>
    call<PoliciesPayload>(
      `/enterprise/policies${status ? `?status=${encodeURIComponent(status)}` : ""}`
    ),
  claims: () => call<ClaimsPayload>("/enterprise/claims"),
  aiSystems: () => call<{ systems: AiSystem[] }>("/enterprise/ai-systems"),
  workflows: () => call<WorkflowsPayload>("/enterprise/workflows"),
  compliance: () =>
    call<{ summary: ComplianceSummary; findings: ComplianceFinding[] }>("/enterprise/compliance"),
  audit: (action: string) =>
    call<{ total: number; entries: AuditEntry[]; actions: { action: string; count: number }[] }>(
      `/enterprise/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`
    ),
};

/** Where a CSV download points. A plain link, so the browser handles it. */
export const reportUrl = (kind: string, format?: "csv") =>
  `${API_URL}/enterprise/reports/${kind}${format ? `?format=${format}` : ""}`;

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
  _count: { uploadedDocuments: number; customerWork: number };
}

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  department: string;
  designation: string;
  branch: string;
  workloadLimit: number;
  openWork: number;
  overdue: number;
  /** ACTIVE | ON_LEAVE | SUSPENDED | EXITED. */
  status: string;
  joinedAt: string;
  trainingStatus: null;
  user: { id: string; name: string; email: string; lastLoginAt: string | null };
}

export interface ProductsPayload {
  companies: { id: string; companyName: string; isActive: boolean; _count: { policies: number } }[];
  policies: {
    id: string;
    policyName: string;
    premium: number;
    coverage: string;
    isActive: boolean;
    version: number;
    updatedAt: string;
    company: { companyName: string };
  }[];
  versionHistory: { available: false; reason: string; needs: string };
}

export interface ClaimsPayload {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageProcessingHours: number | null;
  recent: {
    id: string;
    reference: string;
    title: string;
    status: string;
    priority: string;
    openedAt: string;
    dueAt: string | null;
  }[];
  fraudIndicators: { available: false; reason: string; needs: string };
}

export interface WorkflowsPayload {
  catalogue: {
    definition: string;
    label: string;
    kind: string;
    totalSteps: number;
    humanSteps: number;
    decisionSteps: number;
    steps: {
      key: string;
      name: string;
      description: string;
      actorKind: string;
      requiresDecision: boolean;
    }[];
  }[];
  activity: {
    byDefinition: { definition: string; status: string; count: number }[];
    totals: Record<string, number>;
  };
}

export interface AuditEntry {
  id: string;
  action: string;
  actorId: string | null;
  entity: string | null;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface OrganizationPayload {
  organization: {
    id: string;
    slug: string;
    name: string;
    status: string;
    emailDomains: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    createdAt: string;
    archivedAt: string | null;
    license: {
      plan: string;
      seats: number;
      startsAt: string;
      expiresAt: string | null;
      updatedAt: string;
    } | null;
  };
  /** A licence with no seats and no licence at all are different things. */
  seats: { used: number; total: number } | { available: false; used: number; reason: string };
  customers: number;
  editable: { available: false; reason: string; needs: string };
}

export interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
    onboardedAt: string | null;
    isActive: boolean;
    preferredLanguage: string | null;
  };
  work: {
    id: string;
    reference: string;
    kind: string;
    title: string;
    status: string;
    priority: string;
    openedAt: string;
    resolvedAt: string | null;
  }[];
  /** A count, not the files — an administrator has no need to open them. */
  documents: number;
  logins: {
    id: string;
    outcome: string;
    method: string | null;
    ipAddress: string | null;
    createdAt: string;
  }[];
}

export interface PoliciesPayload {
  total: number;
  byStatus: Record<string, number>;
  /** Sold by this tenant. */
  sold: number;
  /** Declared by the customer as held elsewhere. */
  held: number;
  renewingSoon: number;
  policies: {
    id: string;
    domain: string;
    insurer: string | null;
    productName: string | null;
    policyNumber: string | null;
    sumInsured: number | null;
    premium: number | null;
    startDate: string | null;
    renewalDate: string | null;
    external: boolean;
    status: string;
    profile: { user: { id: string; name: string; email: string } | null } | null;
  }[];
  bookValue: { available: false; reason: string; needs: string };
}

export interface Unavailable {
  available: false;
  reason: string;
  needs: string;
}

export interface RenewalsPayload {
  /** Renewal work somebody has raised. */
  raised: number;
  byStatus: Record<string, number>;
  /** Policies whose renewal date has already passed. */
  overdue: number;
  next30: number;
  next90: number;
  upcoming: {
    id: string;
    domain: string;
    insurer: string | null;
    productName: string | null;
    premium: number | null;
    renewalDate: string | null;
    external: boolean;
    profile: { user: { id: string; name: string; email: string } | null } | null;
  }[];
  renewalRate: Unavailable;
}

export interface DocumentsPayload {
  byStatus: Record<string, number>;
  unowned: number;
  kycByStatus: Record<string, number>;
  kycOverdue: number;
  recent: {
    id: string;
    filename: string;
    documentKey: string | null;
    domain: string | null;
    status: string;
    uploadedAt: string;
    verifiedAt: string | null;
    rejectionReason: string | null;
    owner: { id: string; name: string } | null;
  }[];
  automatedVerification: Unavailable;
}
