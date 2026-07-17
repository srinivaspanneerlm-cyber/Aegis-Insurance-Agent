// ── Transfer & interrupt rules ────────────────────────────────────────────────
//
// Pure decision logic behind the advisor's agent-handoff flow. The page owns the
// React state; this module owns the *rules* — who may hand off to whom, what the
// dialog says, and what the agent replies when the user says no.
//
// `import type` keeps the dialog components out of the runtime graph, so this
// module (and its tests) never pull in React or framer-motion.

import type { TransferRequest } from "@/components/TransferDialog";
import type { InterruptRequest } from "@/components/InterruptDialog";
import type { TransferSuggestion, InterruptSuggestion } from "@/hooks/useStreaming";
import { ADVISORS, PYTHON_DOMAIN_TO_CATEGORY, resolveAdvisorName, type AdvisorKey } from "@/lib/advisors";

/** Agent identity shown in the "Establishing Secure Channel" overlay. */
export interface ConnectingAgent {
  name: string;
  avatar: string;
  theme: string;
  emoji: string;
}

/**
 * Rule 13: once the user declines a handoff to a domain, that domain stops
 * asking for the rest of the session.
 */
export function isDeclined(declinedDomains: ReadonlySet<string>, toDomain: string): boolean {
  return declinedDomains.has(toDomain);
}

/**
 * Build the transfer-permission dialog payload, or `null` if no dialog should
 * be shown — because the user already declined this domain, or because the
 * target domain is one the UI has no advisor for.
 */
export function buildTransferRequest(
  info: TransferSuggestion,
  activeCategory: AdvisorKey,
  declinedDomains: ReadonlySet<string>,
): TransferRequest | null {
  if (isDeclined(declinedDomains, info.transferTo)) return null;

  const toCat = PYTHON_DOMAIN_TO_CATEGORY[info.transferTo];
  if (!toCat) return null;

  const fromCat = PYTHON_DOMAIN_TO_CATEGORY[info.fromDomain] || activeCategory;
  const fromAdv = ADVISORS[fromCat];
  const toAdv = ADVISORS[toCat];

  return {
    fromName: info.fromAgentName,
    fromAvatar: fromAdv.avatar,
    fromTheme: fromAdv.theme,
    fromEmoji: fromAdv.emoji,
    fromDomain: info.fromDomain,
    toName: info.transferToName || toAdv.name,
    toAvatar: toAdv.avatar,
    toTheme: toAdv.theme,
    toEmoji: toAdv.emoji,
    toDomain: info.transferTo,
    reason: info.transferReason,
  };
}

/**
 * Build the mid-workflow interrupt dialog payload, or `null` when the switch
 * must not be offered. Same gates as {@link buildTransferRequest}, plus the
 * workflow labels the interrupt dialog shows on each side.
 */
export function buildInterruptRequest(
  info: InterruptSuggestion,
  activeCategory: AdvisorKey,
  declinedDomains: ReadonlySet<string>,
): InterruptRequest | null {
  if (isDeclined(declinedDomains, info.transferTo)) return null;

  const toCat = PYTHON_DOMAIN_TO_CATEGORY[info.transferTo];
  if (!toCat) return null;

  const fromCat = PYTHON_DOMAIN_TO_CATEGORY[info.fromDomain] || activeCategory;
  const fromAdv = ADVISORS[fromCat];
  const toAdv = ADVISORS[toCat];

  return {
    fromName: info.fromAgentName,
    fromAvatar: fromAdv.avatar,
    fromTheme: fromAdv.theme,
    fromEmoji: fromAdv.emoji,
    fromDomain: info.fromDomain,
    fromLabel: info.fromLabel,
    toName: info.transferToName || toAdv.name,
    toAvatar: toAdv.avatar,
    toTheme: toAdv.theme,
    toEmoji: toAdv.emoji,
    toDomain: info.transferTo,
    toLabel: info.transferToLabel,
  };
}

/**
 * Identity for the connecting overlay shown the instant the user approves,
 * before the stream opens. `null` for a domain with no advisor — the overlay is
 * then skipped rather than rendered blank.
 */
export function buildConnectingAgent(toDomain: string, toName: string): ConnectingAgent | null {
  const toCat = PYTHON_DOMAIN_TO_CATEGORY[toDomain];
  if (!toCat) return null;
  const toAdv = ADVISORS[toCat];
  return { name: toName, avatar: toAdv.avatar, theme: toAdv.theme, emoji: toAdv.emoji };
}

/**
 * Rule 4: on decline the current agent acknowledges and stays, leaving the door
 * open rather than dropping the subject.
 */
export function transferDeclineMessage(toName: string): string {
  return `Understood — I'll continue to assist you here. If you ever need help with ${toName.replace(" AI", "")}'s expertise, just let me know and I can arrange that.`;
}

/** Declining an interrupt resumes the workflow the user was already in. */
export function interruptDeclineMessage(fromLabel: string): string {
  return `No problem at all — let's continue with your ${fromLabel} Insurance consultation. Where were we?`;
}

/**
 * The message replayed to the new agent on approval. The user's last message is
 * preferred so the specialist answers the actual question instead of a greeting;
 * the fallback only covers a handoff with no user turn behind it.
 */
export function transferConfirmPrompt(lastUserMsg: string, toName: string): string {
  return lastUserMsg || `Please connect me with ${toName}.`;
}

export function interruptConfirmPrompt(lastUserMsg: string, toName: string): string {
  return lastUserMsg || `Please switch me to ${toName}.`;
}

/** Rule 6: prompt that hands the user back to the advisor they came from. */
export function returnToPreviousPrompt(previousCategory: AdvisorKey): string {
  return `Please reconnect me to ${ADVISORS[previousCategory].name}.`;
}

/**
 * Display name for the agent a transfer came from. Falls back to the raw domain
 * so an unknown backend domain still labels the message rather than blanking it.
 */
export function resolveAgentNameForDomain(domain: string): string {
  return resolveAdvisorName(domain, domain);
}

/** Category to restore for the "return to previous advisor" pill, if resolvable. */
export function resolvePreviousCategory(previousAgentDomain: string): AdvisorKey | null {
  return PYTHON_DOMAIN_TO_CATEGORY[previousAgentDomain] || null;
}
