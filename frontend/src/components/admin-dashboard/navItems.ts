import {
  TrendingUp, FileSpreadsheet, MessageSquare, Lock, Sliders, Terminal, LucideIcon,
} from "lucide-react";
import type { AdminNav } from "./types";

/**
 * Admin sidebar navigation items. Single source for the command-center nav,
 * typed so `id` is an `AdminNav` — removing the former `as any` cast at the
 * call site. Mirrors the consumer dashboard's navItems.
 */
export interface AdminNavItem {
  id: AdminNav;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "analytics", label: "Telemetry Matrix", icon: TrendingUp },
  { id: "leads", label: "Underwrite Vault", icon: FileSpreadsheet },
  { id: "chats", label: "Dialogue Monitor", icon: MessageSquare },
  { id: "vault", label: "Secure Crypt-Vault", icon: Lock },
  { id: "automation", label: "Control Triggers", icon: Sliders },
  { id: "telemetry", label: "System Core Logs", icon: Terminal },
];
