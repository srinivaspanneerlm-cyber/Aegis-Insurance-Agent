/**
 * What the enterprise console is made of.
 *
 * Navigation, the API surface and the shapes it returns, written once so the
 * sidebar, the guard and the pages cannot disagree about which sections exist.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3105";

export const ACCESS_DENIED_URL = `${IDENTITY_URL}/access-denied?portal=enterprise`;
export const SIGN_IN_URL = `${IDENTITY_URL}/login?portal=ENTERPRISE`;

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /** The capability the section needs. Sections they cannot use are not shown. */
  readonly permission?: string;
  readonly comingSoon?: boolean;
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * The sidebar, grouped by the question a section answers.
 *
 * Eighteen flat entries is a list somebody scans rather than reads. Grouped —
 * the business, the people, the machinery, the governance — it becomes four
 * short lists, and an administrator looking for an audit trail knows which one
 * to look in without reading the other three.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: "chart" },
      {
        label: "Organisation",
        href: "/organisation",
        icon: "building",
        permission: "analytics.read",
      },
      {
        label: "Business Analytics",
        href: "/analytics",
        icon: "chart",
        permission: "analytics.read",
      },
      {
        label: "Enterprise Reports",
        href: "/reports",
        icon: "layers",
        permission: "analytics.read",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Customer Management",
        href: "/customers",
        icon: "users",
        permission: "customer.read",
      },
      {
        label: "Employee Management",
        href: "/employees",
        icon: "briefcase",
        permission: "staff.manage",
      },
      { label: "Products", href: "/products", icon: "shield", permission: "policy.read" },
      { label: "Claims Management", href: "/claims", icon: "scales", permission: "claim.read" },
      {
        label: "Policy Management",
        href: "/policies",
        icon: "book",
        permission: "policy.read",
        comingSoon: true,
      },
      {
        label: "Renewals",
        href: "/renewals",
        icon: "refresh",
        permission: "policy.read",
        comingSoon: true,
      },
      {
        label: "Document Center",
        href: "/documents",
        icon: "book",
        permission: "customer.read",
        comingSoon: true,
      },
      {
        label: "KYC Monitoring",
        href: "/kyc",
        icon: "eye",
        permission: "customer.read",
        comingSoon: true,
      },
    ],
  },
  {
    title: "Automation",
    items: [
      { label: "AI Agents", href: "/ai-systems", icon: "spark", permission: "platform.configure" },
      {
        label: "Workflow Automation",
        href: "/workflows",
        icon: "bolt",
        permission: "analytics.read",
      },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Compliance", href: "/compliance", icon: "shield", permission: "audit.read" },
      { label: "Audit Logs", href: "/audit", icon: "search", permission: "audit.read" },
      { label: "Notifications", href: "/notifications", icon: "bolt", comingSoon: true },
      { label: "Settings", href: "/settings", icon: "compass", comingSoon: true },
    ],
  },
];

// ── What the API returns ─────────────────────────────────────────────────────

/**
 * A figure that may not exist.
 *
 * The console renders these two shapes differently on purpose: a measured
 * number gets a stat card, and an unmeasured one gets a card that says what
 * would have to be recorded. Collapsing them to `number | null` would produce a
 * dash that reads as zero.
 */
export type Metric<T> =
  { available: true; value: T } | { available: false; reason: string; needs: string };

export interface Overview {
  generatedAt: string;
  customers: Metric<{ total: number; newThisWeek: number; unverified: number }>;
  employees: Metric<{ total: number; active: number }>;
  policies: Metric<{ active: number; insurers: number }>;
  claims: Metric<{
    total: number;
    open: number;
    resolved: number;
    closed: number;
    overdue: number;
    averageResolutionHours: number | null;
  }>;
  renewals: Metric<{ total: number }>;
  kyc: Metric<{ total: number }>;
  complaints: Metric<{ total: number }>;
  documents: Metric<{ total: number; thisWeek: number }>;
  system: Metric<{ liveSessions: number; failedLoginsToday: number; auditEventsToday: number }>;
  revenue: Metric<never>;
  customerSatisfaction: Metric<never>;
  fraudSignals: Metric<never>;
  documentVerification: Metric<never>;
}

export interface ComplianceSummary {
  checksRun: number;
  passing: number;
  failing: number;
  critical: number;
  high: number;
  verdict: "CLEAR" | "ATTENTION" | "ACTION_REQUIRED";
  disclaimer: string;
}

export interface ComplianceFinding {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  count: number;
  detail: string;
  remedy: string;
}

export interface AiSystem {
  id: string;
  name: string;
  purpose: string;
  audience: string;
  health: "HEALTHY" | "DEGRADED" | "IDLE" | "NOT_INSTRUMENTED";
  activity: number | null;
  successRate: number | null;
  errorRate: number | null;
  workload: number | null;
  lastActivityAt: string | null;
  notes: string;
  configurable: string[];
}

export interface Branch {
  branch: string;
  employees: number;
  active: number;
  openWork: number;
  overdue: number;
}

export interface DashboardPayload {
  overview: Overview;
  trend: { date: string; count: number }[];
  branches: Branch[];
  compliance: ComplianceSummary;
  aiSystems: {
    id: string;
    name: string;
    health: string;
    activity: number | null;
    workload: number | null;
  }[];
}

export const SEVERITY_TONE = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  INFO: "neutral",
} as const;

export const HEALTH_TONE = {
  HEALTHY: "success",
  DEGRADED: "danger",
  IDLE: "warning",
  NOT_INSTRUMENTED: "neutral",
} as const;
