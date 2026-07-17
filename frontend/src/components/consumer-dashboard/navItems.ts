import { Activity, Heart, Sparkles, Shield, FileText, Bell, LucideIcon } from "lucide-react";
import type { NavId } from "./types";

/**
 * Sidebar navigation items. Single source shared by the desktop and mobile
 * navs (previously the same list was hardcoded twice), and typed so `id` is a
 * `NavId` — removing the former `as any` casts at the call sites.
 */
export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Overview Console", icon: Activity },
  { id: "policies", label: "Protection Plans", icon: Heart },
  { id: "advisor", label: "AI Advisor Core", icon: Sparkles },
  { id: "claims", label: "Claims Safe-Track", icon: Shield },
  { id: "documents", label: "Secure Doc Vault", icon: FileText },
  { id: "notifications", label: "Security Bulletins", icon: Bell },
];
