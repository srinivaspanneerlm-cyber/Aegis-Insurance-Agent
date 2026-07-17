import type { ChatMsg } from "@/components/ChatMessage";
import { agentHistoryKey } from "@/lib/storage-keys";

export function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Per-agent localStorage history helpers ────────────────────────────────────

export const loadAgentHistory = (domain: string): ChatMsg[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(agentHistoryKey(domain));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatMsg[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

export const saveAgentHistory = (domain: string, msgs: ChatMsg[]) => {
  if (typeof window === "undefined" || msgs.length === 0) return;
  try {
    // Don't save if it's just the intro message
    if (msgs.length === 1 && msgs[0].id === "intro") return;
    localStorage.setItem(agentHistoryKey(domain), JSON.stringify(msgs.slice(-200)));
  } catch {}
};

export const clearAgentHistory = (domain: string) => {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(agentHistoryKey(domain)); } catch {}
};
