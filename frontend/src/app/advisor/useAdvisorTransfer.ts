"use client";

import { useState, useRef, useCallback } from "react";
import type { TransferRequest } from "@/components/TransferDialog";
import type { InterruptRequest } from "@/components/InterruptDialog";
import type { TransferSuggestion, InterruptSuggestion } from "@/hooks/useStreaming";
import { ADVISORS, type AdvisorKey } from "@/lib/advisors";
import {
  buildTransferRequest,
  buildInterruptRequest,
  buildConnectingAgent,
  transferDeclineMessage,
  interruptDeclineMessage,
  transferConfirmPrompt,
  interruptConfirmPrompt,
  returnToPreviousPrompt,
  resolvePreviousCategory,
  type ConnectingAgent,
} from "./transferRules";

/** What the still-present agent says after the user turns a handoff down. */
export interface DeclineReply {
  text: string;
  agentName: string;
  agentDomain: string;
}

/** One-shot flags a queued handoff contributes to the next outbound stream. */
export interface PendingTransfer {
  forceTransferTo: string | undefined;
  skipInterrupt: boolean;
}

/**
 * Owns the agent-handoff choreography: which dialog is open, which domains the
 * user has already refused, and the one-shot flags the next stream must carry.
 *
 * The decision rules live in `./transferRules` (pure, separately tested); this
 * hook is the state and sequencing around them. It deliberately does not send
 * anything — the confirm/return actions *return the prompt to send* and the
 * caller owns the transport, which keeps the hook free of the streaming layer.
 */
export function useAdvisorTransfer() {
  const [transferRequest, setTransferRequest] = useState<TransferRequest | null>(null);
  const [interruptRequest, setInterruptRequest] = useState<InterruptRequest | null>(null);
  const [connectingTo, setConnectingTo] = useState<ConnectingAgent | null>(null);
  const [previousAdvisorCategory, setPreviousAdvisorCategory] = useState<AdvisorKey | null>(null);

  // Refs, not state: consumed mid-send, and a re-render must never replay them.
  const declinedDomainsRef = useRef<Set<string>>(new Set());
  const pendingForceTransferRef = useRef<string | null>(null);
  const skipInterruptRef = useRef(false);

  const suggestTransfer = useCallback((info: TransferSuggestion, activeCategory: AdvisorKey) => {
    const req = buildTransferRequest(info, activeCategory, declinedDomainsRef.current);
    if (req) setTransferRequest(req);
  }, []);

  const suggestInterrupt = useCallback((info: InterruptSuggestion, activeCategory: AdvisorKey) => {
    const req = buildInterruptRequest(info, activeCategory, declinedDomainsRef.current);
    if (req) setInterruptRequest(req);
  }, []);

  /**
   * Read and clear the queued handoff flags. One-shot by design: a forced
   * transfer must apply to exactly the next message, never leak into the one
   * after it.
   */
  const consumePending = useCallback((): PendingTransfer => {
    const forceTransferTo = pendingForceTransferRef.current || undefined;
    pendingForceTransferRef.current = null;
    const skipInterrupt = skipInterruptRef.current;
    skipInterruptRef.current = false;
    return { forceTransferTo, skipInterrupt };
  }, []);

  /** Approve the handoff. Returns the prompt to send, or null if no dialog was open. */
  const confirmTransfer = useCallback((lastUserMsg: string): string | null => {
    const req = transferRequest;
    setTransferRequest(null);
    if (!req) return null;
    // Overlay goes up immediately, before the stream opens.
    const connecting = buildConnectingAgent(req.toDomain, req.toName);
    if (connecting) setConnectingTo(connecting);
    pendingForceTransferRef.current = req.toDomain;
    return transferConfirmPrompt(lastUserMsg, req.toName);
  }, [transferRequest]);

  const declineTransfer = useCallback((): DeclineReply | null => {
    const req = transferRequest;
    setTransferRequest(null);
    if (!req) return null;
    declinedDomainsRef.current.add(req.toDomain);
    return {
      text: transferDeclineMessage(req.toName),
      agentName: req.fromName,
      agentDomain: req.fromDomain,
    };
  }, [transferRequest]);

  const confirmInterrupt = useCallback((lastUserMsg: string): string | null => {
    const req = interruptRequest;
    setInterruptRequest(null);
    if (!req) return null;
    const connecting = buildConnectingAgent(req.toDomain, req.toName);
    if (connecting) setConnectingTo(connecting);
    pendingForceTransferRef.current = req.toDomain;
    return interruptConfirmPrompt(lastUserMsg, req.toName);
  }, [interruptRequest]);

  const declineInterrupt = useCallback((): DeclineReply | null => {
    const req = interruptRequest;
    setInterruptRequest(null);
    if (!req) return null;
    declinedDomainsRef.current.add(req.toDomain);
    return {
      text: interruptDeclineMessage(req.fromLabel),
      agentName: req.fromName,
      agentDomain: req.fromDomain,
    };
  }, [interruptRequest]);

  /** Rule 6: hand the user back. Returns the prompt to send, or null if there is nowhere to go back to. */
  const returnToPrevious = useCallback((): string | null => {
    if (!previousAdvisorCategory) return null;
    const prompt = returnToPreviousPrompt(previousAdvisorCategory);
    pendingForceTransferRef.current = ADVISORS[previousAdvisorCategory].pythonDomain;
    setPreviousAdvisorCategory(null);
    return prompt;
  }, [previousAdvisorCategory]);

  /** After a completed transfer, remember where the user came from. */
  const recordPreviousAgent = useCallback((previousAgentDomain: string) => {
    const prevCat = resolvePreviousCategory(previousAgentDomain);
    if (prevCat) setPreviousAdvisorCategory(prevCat);
  }, []);

  /** The stream is live — take the connecting overlay down. */
  const dismissConnecting = useCallback(() => setConnectingTo(null), []);

  return {
    transferRequest,
    interruptRequest,
    connectingTo,
    previousAdvisorCategory,
    suggestTransfer,
    suggestInterrupt,
    consumePending,
    confirmTransfer,
    declineTransfer,
    confirmInterrupt,
    declineInterrupt,
    returnToPrevious,
    recordPreviousAgent,
    dismissConnecting,
  };
}
