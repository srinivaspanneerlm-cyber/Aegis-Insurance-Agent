/**
 * What the platform console is made of.
 *
 * Navigation and the API shapes, written once so the sidebar, the guard and the
 * pages cannot disagree about which sections exist.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3105";

export const ACCESS_DENIED_URL = `${IDENTITY_URL}/access-denied?portal=platform`;
export const SIGN_IN_URL = `${IDENTITY_URL}/login?portal=PLATFORM`;

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  readonly permission?: string;
  readonly comingSoon?: boolean;
}
export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * The sidebar.
 *
 * No per-item permission gating here, unlike the other consoles: everything in
 * this application requires `platform.configure`, and anybody who reached a
 * page at all holds it. Repeating the check per item would be theatre.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    title: "Platform",
    items: [
      { label: "Dashboard", href: "/", icon: "chart" },
      { label: "Infrastructure", href: "/infrastructure", icon: "layers" },
      { label: "System Monitoring", href: "/monitoring", icon: "bolt" },
    ],
  },
  {
    title: "Tenancy",
    items: [
      { label: "Organizations", href: "/organizations", icon: "building" },
      { label: "License Management", href: "/licences", icon: "briefcase" },
      { label: "Identity Management", href: "/identities", icon: "users" },
      { label: "Role Management", href: "/roles", icon: "shield" },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "AI Governance", href: "/ai-governance", icon: "spark" },
      { label: "Security Center", href: "/security", icon: "lock" },
      { label: "Audit Logs", href: "/audit", icon: "search" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Platform Configuration", href: "/settings", icon: "compass" },
      { label: "Integrations", href: "/integrations", icon: "refresh" },
      { label: "Backup & Recovery", href: "/backup", icon: "book" },
      { label: "API Gateway", href: "/gateway", icon: "bolt", comingSoon: true },
      { label: "Notifications", href: "/notifications", icon: "mail", comingSoon: true },
    ],
  },
];

export type ComponentStatus = "UP" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED";

export interface ComponentHealth {
  id: string;
  name: string;
  status: ComponentStatus;
  latencyMs: number | null;
  detail: string;
  implementation: string;
}

export interface Resources {
  process: {
    uptimeSeconds: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    pid: number;
    nodeVersion: string;
  };
  host: {
    platform: string;
    cores: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    usedMemoryPercent: number;
    loadAverage: { one: number; five: number; fifteen: number };
    loadPerCore: number | null;
    loadAverageMeaningful: boolean;
    uptimeSeconds: number;
  };
}

export interface Gap {
  id?: string;
  field?: string;
  label?: string;
  reason: string;
  needs: string;
}

/**
 * A figure that may not exist.
 *
 * Rendered as a distinct card rather than a dash, because a dash reads as zero
 * and "no revenue recorded" is a very different claim from "revenue is zero".
 */
export type Metric<T> =
  { available: true; value: T } | { available: false; reason: string; needs: string };

export interface Overview {
  generatedAt: string;
  components: ComponentHealth[];
  resources: Resources;
  missingTelemetry: Gap[];
  identity: { customers: number; employees: number; admins: number; operators: number };
  organizations: Record<string, number>;
  licences: Record<string, number>;
  ai: { id: string; name: string; health: string; activity: number | null }[];
  security: {
    failedLoginsToday: number;
    failedLoginsThisWeek: number;
    permissionDenialsToday: number;
    accountsLockedNow: number;
    outcomes: Record<string, number>;
  };
  revenue: { available: false; reason: string; needs: string };
}

export const STATUS_TONE = {
  UP: "success",
  DEGRADED: "warning",
  DOWN: "danger",
  NOT_CONFIGURED: "neutral",
} as const;

export const HEALTH_TONE = {
  HEALTHY: "success",
  DEGRADED: "danger",
  IDLE: "warning",
  NOT_INSTRUMENTED: "neutral",
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024,
    u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
