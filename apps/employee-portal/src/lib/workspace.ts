/**
 * What the employee workspace is made of.
 *
 * Navigation, the API surface and the shapes the API returns, in one place so
 * the sidebar, the guard and the pages cannot disagree about which sections
 * exist or what they are called.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3105";

/** Where a wrong-realm arrival is sent. Named once; used by the guard. */
export const ACCESS_DENIED_URL = `${IDENTITY_URL}/access-denied?portal=employee`;
export const SIGN_IN_URL = `${IDENTITY_URL}/login?portal=EMPLOYEE`;

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /**
   * The capability the section needs. A section the person cannot use is not
   * rendered — the API would refuse it anyway, and a menu full of dead ends is
   * how enterprise software earns its reputation.
   */
  readonly permission?: string;
  /** Sections whose screens are not built yet say so rather than 404ing. */
  readonly comingSoon?: boolean;
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * The sidebar, grouped.
 *
 * Sixteen flat entries is a list somebody scans rather than reads. Grouped by
 * what the work *is* — the queue, the customer, the reference material — it
 * becomes four short lists, which is the difference between finding something
 * and hunting for it.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    title: "Work",
    items: [
      { label: "Dashboard", href: "/", icon: "chart" },
      { label: "My Tasks", href: "/tasks", icon: "check", permission: "work.read" },
      { label: "Claims Management", href: "/claims", icon: "shield", permission: "work.read" },
      { label: "KYC Verification", href: "/kyc", icon: "users", permission: "work.read" },
      { label: "Renewals", href: "/renewals", icon: "refresh", permission: "work.read" },
      {
        label: "Document Verification",
        href: "/documents",
        icon: "book",
        permission: "work.read",
      },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        label: "Assigned Customers",
        href: "/customers",
        icon: "users",
        permission: "customer.read",
      },
      {
        label: "Customer Support",
        href: "/support",
        icon: "phone",
        permission: "work.read",
      },
      {
        label: "Appointments",
        href: "/appointments",
        icon: "clock",
        permission: "work.read",
        comingSoon: true,
      },
      {
        label: "Policy Management",
        href: "/policies",
        icon: "briefcase",
        permission: "policy.read",
        comingSoon: true,
      },
    ],
  },
  {
    title: "Insight",
    items: [
      { label: "Analytics", href: "/analytics", icon: "chart", permission: "analytics.read" },
      {
        label: "Reports",
        href: "/reports",
        icon: "layers",
        permission: "analytics.read",
        comingSoon: true,
      },
      { label: "Knowledge Center", href: "/knowledge", icon: "book", permission: "knowledge.read" },
    ],
  },
  {
    title: "Assistance",
    items: [
      { label: "AI Assistant", href: "/assistant", icon: "spark" },
      { label: "Notifications", href: "/notifications", icon: "bolt", comingSoon: true },
      { label: "Settings", href: "/settings", icon: "compass", comingSoon: true },
    ],
  },
];

// ── What the API returns ─────────────────────────────────────────────────────

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  department: string;
  designation: string;
  branch: string;
  status: string;
  workloadLimit: number;
  joinedAt: string;
}

export interface Workload {
  verdict: "HEALTHY" | "BUSY" | "AT_CAPACITY" | "OVERLOADED";
  utilisation: number;
  advice: string;
}

export interface WorkItem {
  id: string;
  kind: string;
  reference: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  openedAt: string;
}

export interface Analytics {
  scope: "MINE" | "TEAM";
  openCases: number;
  overdueCases: number;
  resolvedToday: number;
  resolvedThisWeek: number;
  averageResolutionMinutes: number | null;
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  tags: string | null;
  publishedAt: string;
}

/** Human labels for the codes the API stores. */
export const KIND_LABELS: Record<string, string> = {
  CLAIM: "Claim",
  KYC: "KYC",
  RENEWAL: "Renewal",
  COMPLAINT: "Complaint",
  APPOINTMENT: "Appointment",
  TASK: "Task",
};

export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  AWAITING_CUSTOMER: "Awaiting customer",
  AWAITING_APPROVAL: "Awaiting approval",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const PRIORITY_ORDER = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;

/** Overdue is a state, not a status — it is derived, and it is what people act on. */
export const isOverdue = (item: WorkItem): boolean =>
  Boolean(item.dueAt) && new Date(item.dueAt as string) < new Date();
