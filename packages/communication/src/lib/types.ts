/**
 * The communication platform's vocabulary, as the portals consume it.
 *
 * Mirrors the backend contracts rather than importing them — the backend is not
 * in this workspace, and a browser bundle must not depend on a server module.
 */

export const NOTIFICATION_CATEGORIES = [
  "POLICY",
  "CLAIM",
  "DOCUMENT",
  "RENEWAL",
  "SECURITY",
  "ANNOUNCEMENT",
  "MAINTENANCE",
  "AI_SUGGESTION",
  "TASK",
  "MESSAGE",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type Tone = "danger" | "warning" | "info" | "neutral" | "success";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  priority: Priority;
  status: "UNREAD" | "READ" | "ARCHIVED";
  deepLink: string | null;
  createdAt: string;
}

export interface InboxItem {
  itemKind: "conversation" | "notification" | "announcement";
  id: string;
  title: string;
  body: string | null;
  category: string;
  priority: string;
  at: string;
  unread: boolean;
  messageCount: number;
  deepLink: string | null;
}

export interface ThreadMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  senderKind: "USER" | "AI" | "SYSTEM";
  senderAgent: string | null;
  body: string;
  kind: "NOTE" | "REPLY" | "SUMMARY" | "SUGGESTION" | "SYSTEM_EVENT";
  internal: boolean;
  attachmentIds: string[];
  editedAt: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  at: string;
  source: string;
  kind: string;
  summary: string;
  actorId: string | null;
  actorKind: string;
  subjectKind: string;
  subjectId: string;
  deepLink: string | null;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  publishedAt: string | null;
  read: boolean;
}

/**
 * How each category is said to a person.
 *
 * Plain words rather than the enum. "AI_SUGGESTION" is a database value; "A
 * suggestion from Aegis" is what somebody reads at seven in the morning on a
 * phone.
 */
export const CATEGORY_META: Record<NotificationCategory, { label: string; tone: Tone }> = {
  POLICY: { label: "Your policy", tone: "info" },
  CLAIM: { label: "Your claim", tone: "info" },
  DOCUMENT: { label: "Documents", tone: "info" },
  RENEWAL: { label: "Renewal", tone: "warning" },
  SECURITY: { label: "Security", tone: "danger" },
  ANNOUNCEMENT: { label: "Announcement", tone: "neutral" },
  MAINTENANCE: { label: "Maintenance", tone: "warning" },
  AI_SUGGESTION: { label: "A suggestion from Aegis", tone: "success" },
  TASK: { label: "Task", tone: "info" },
  MESSAGE: { label: "Message", tone: "neutral" },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  URGENT: { label: "Urgent", tone: "danger" },
  HIGH: { label: "Soon", tone: "warning" },
  NORMAL: { label: "", tone: "neutral" },
  LOW: { label: "", tone: "neutral" },
};

/** Which subsystem an entry came from, in words rather than a table name. */
export const SOURCE_META: Record<string, { label: string; tone: Tone }> = {
  document: { label: "Document", tone: "info" },
  work: { label: "Case", tone: "info" },
  intelligence: { label: "Advice", tone: "success" },
  notification: { label: "Notification", tone: "neutral" },
  message: { label: "Conversation", tone: "neutral" },
};

/**
 * "3 minutes ago". Falls back to a date past a week.
 *
 * Relative time is friendlier for recent things and actively unhelpful for old
 * ones — "47 days ago" makes somebody do arithmetic to find a date.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 7200) return "an hour ago";
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "yesterday";
  if (seconds < 604800) return `${Math.round(seconds / 86400)} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const TONE_BORDER: Record<Tone, string> = {
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
  info: "border-info/40 text-info",
  success: "border-success/40 text-success",
  neutral: "border-line/60 text-content-muted",
};

export const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
  neutral: "bg-line",
};
