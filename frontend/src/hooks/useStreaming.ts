"use client";
import { useState, useCallback, useRef } from "react";

// The advisor stream is proxied by the Node backend, which authenticates the
// customer and tells the AI engine who they are. The browser never addresses
// the AI service directly — it has no way to prove identity to it.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThinkingStep {
  step: string;
  label: string;
}

export type StreamPhase = "idle" | "thinking" | "streaming" | "done" | "error";

export interface StreamState {
  phase: StreamPhase;
  thinkingStep: ThinkingStep | null;
  thinkingHistory: ThinkingStep[];
  text: string;
  agentName: string;
  agentDomain: string;
  transferred: boolean;
  suggestTransfer: boolean;
  transferFrom: string | null;
  transferTo: string | null;
  transferToName: string | null;
  transferReason: string | null;
  previousAgent: string | null;
  sessionId: string;
  error: string | null;
}

export interface TransferSuggestion {
  fromAgentName: string;
  fromDomain: string;
  transferTo: string;
  transferToName: string;
  transferReason: string;
}

export interface InterruptSuggestion {
  fromAgentName: string;
  fromDomain: string;
  fromLabel: string;
  transferTo: string;
  transferToName: string;
  transferToLabel: string;
}

export interface StreamCallbacks {
  onThinking?: (step: ThinkingStep) => void;
  onAgentInfo?: (info: {
    agentName: string;
    agentDomain: string;
    transferred: boolean;
    suggestTransfer: boolean;
    isInterrupt: boolean;
    transferFrom: string | null;
    transferTo: string | null;
    transferToName: string | null;
    transferReason: string | null;
    previousAgent: string | null;
    sessionId: string;
  }) => void;
  onToken?: (accumulated: string) => void;
  onDone?: (result: {
    text: string;
    agentName: string;
    agentDomain: string;
    transferred: boolean;
    suggestTransfer: boolean;
    transferFrom: string | null;
    transferTo: string | null;
    transferToName: string | null;
    transferReason: string | null;
    previousAgent: string | null;
    sessionId: string;
  }) => void;
  onTransferSuggested?: (info: TransferSuggestion) => void;
  onInterruptSuggested?: (info: InterruptSuggestion) => void;
  onError?: (message: string) => void;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

const IDLE: StreamState = {
  phase: "idle",
  thinkingStep: null,
  thinkingHistory: [],
  text: "",
  agentName: "Sarah AI",
  agentDomain: "health",
  transferred: false,
  suggestTransfer: false,
  transferFrom: null,
  transferTo: null,
  transferToName: null,
  transferReason: null,
  previousAgent: null,
  sessionId: "",
  error: null,
};

// Thinking steps used when SSE fails and we fall back to simulated streaming
const FALLBACK_STEPS: Record<string, ThinkingStep[]> = {
  health:         [
    { step: "intent",   label: "Understanding your health insurance needs..." },
    { step: "profile",  label: "Reviewing your family profile..." },
    { step: "options",  label: "Finding the best health plans for you..." },
    { step: "rec",      label: "Preparing your personalized recommendation..." },
  ],
  motor:          [
    { step: "intent",  label: "Understanding your vehicle insurance needs..." },
    { step: "vehicle", label: "Reviewing vehicle details..." },
    { step: "idv",     label: "Calculating Insured Declared Value..." },
    { step: "rec",     label: "Building your personalized motor quote..." },
  ],
  travel:         [
    { step: "intent",      label: "Understanding your travel needs..." },
    { step: "destination", label: "Analyzing destination requirements..." },
    { step: "rec",         label: "Preparing your travel cover recommendation..." },
  ],
  "home-property":[
    { step: "intent",    label: "Understanding your property insurance needs..." },
    { step: "property",  label: "Reviewing your property details..." },
    { step: "rec",       label: "Preparing your property protection plan..." },
  ],
  executive:      [
    { step: "intent",  label: "Understanding what you're looking for..." },
    { step: "match",   label: "Matching you with the right specialist..." },
    { step: "connect", label: "Getting ready to connect you..." },
  ],
  miscellaneous:  [
    { step: "intent",   label: "Understanding your request..." },
    { step: "options",  label: "Finding relevant coverage options..." },
    { step: "rec",      label: "Preparing your recommendation..." },
  ],
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStreaming() {
  const [state, setState] = useState<StreamState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef("");
  // Track mutable agent info so callbacks get fresh values
  const agentRef = useRef({
    agentName: "Sarah AI", agentDomain: "health",
    transferred: false, suggestTransfer: false, isInterrupt: false,
    transferFrom: null as string | null, transferTo: null as string | null,
    transferToName: null as string | null, transferReason: null as string | null,
    previousAgent: null as string | null, sessionId: "",
  });

  const stream = useCallback(async (
    message: string,
    history: ChatHistoryItem[],
    productType: string,
    sessionId: string,
    callbacks?: StreamCallbacks,
    forceTransferTo?: string,
    declinedDomains?: string[],
  ) => {
    // Cancel any in-progress request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    textRef.current = "";
    agentRef.current = {
      agentName: "Sarah AI", agentDomain: productType || "health",
      transferred: false, suggestTransfer: false, isInterrupt: false,
      transferFrom: null, transferTo: null, transferToName: null,
      transferReason: null, previousAgent: null, sessionId,
    };

    setState({ ...IDLE, phase: "thinking", thinkingStep: { step: "init", label: "Connecting to advisor..." }, sessionId });

    let sseSucceeded = false;

    // ── Try real SSE streaming from Python ────────────────────────────────────
    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Auth rides in the httpOnly cookie; the backend derives the customer
        // from it. Deliberately no user_name here — identity is not the
        // browser's to assert.
        credentials: "include",
        body: JSON.stringify({
          message,
          history,
          product_type: productType,
          session_id: sessionId,
          force_transfer_to: forceTransferTo || null,
          declined_domains: declinedDomains || [],
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      sseSucceeded = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "thinking") {
              const step: ThinkingStep = { step: ev.step, label: ev.label };
              setState(prev => ({
                ...prev,
                phase: "thinking",
                thinkingStep: step,
                thinkingHistory: [...prev.thinkingHistory, step],
              }));
              callbacks?.onThinking?.(step);

            } else if (ev.type === "agent_info") {
              agentRef.current = {
                agentName:      ev.agent_name || "Sarah AI",
                agentDomain:    ev.agent_domain || productType,
                transferred:    !!ev.transferred,
                suggestTransfer: !!ev.suggest_transfer,
                isInterrupt:    !!ev.is_interrupt,
                transferFrom:   ev.transfer_from || null,
                transferTo:     ev.transfer_to || null,
                transferToName: ev.transfer_to_name || null,
                transferReason: ev.transfer_reason || null,
                previousAgent:  ev.previous_agent || null,
                sessionId:      ev.session_id || sessionId,
              };
              setState(prev => ({
                ...prev,
                phase: "streaming",
                text: "",
                ...agentRef.current,
              }));
              callbacks?.onAgentInfo?.(agentRef.current);

            } else if (ev.type === "token") {
              textRef.current += ev.text || "";
              const t = textRef.current;
              setState(prev => ({ ...prev, text: t }));
              callbacks?.onToken?.(t);

            } else if (ev.type === "done") {
              const finalSessionId = ev.session_id || agentRef.current.sessionId;
              agentRef.current.sessionId = finalSessionId;
              setState(prev => ({ ...prev, phase: "done", sessionId: finalSessionId }));
              callbacks?.onDone?.({
                text: textRef.current,
                ...agentRef.current,
                sessionId: finalSessionId,
              });
              // Fire suggestion callbacks AFTER done so dialog appears post-stream
              if (agentRef.current.suggestTransfer && agentRef.current.transferTo) {
                if (agentRef.current.isInterrupt) {
                  // Mid-workflow interrupt — show specialized "progress saved" dialog
                  const fromLabel = (agentRef.current.transferFrom || agentRef.current.agentDomain)
                    .replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                  const toLabel = (agentRef.current.transferTo || "")
                    .replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                  callbacks?.onInterruptSuggested?.({
                    fromAgentName:  agentRef.current.agentName,
                    fromDomain:     agentRef.current.agentDomain,
                    fromLabel,
                    transferTo:     agentRef.current.transferTo,
                    transferToName: agentRef.current.transferToName || "",
                    transferToLabel: toLabel,
                  });
                } else {
                  // Regular transfer suggestion
                  callbacks?.onTransferSuggested?.({
                    fromAgentName: agentRef.current.agentName,
                    fromDomain:    agentRef.current.agentDomain,
                    transferTo:    agentRef.current.transferTo,
                    transferToName: agentRef.current.transferToName || "",
                    transferReason: agentRef.current.transferReason || "",
                  });
                }
              }
              return;

            } else if (ev.type === "error") {
              const msg = ev.message || "An unexpected error occurred.";
              setState(prev => ({ ...prev, phase: "error", error: msg }));
              callbacks?.onError?.(msg);
              return;
            }
          } catch {
            // Partial JSON / empty line — skip
          }
        }
      }

    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      // SSE failed — fall through to simulated streaming below
    }

    if (sseSucceeded) return; // SSE ran but ended without "done" — rare; treat as complete

    // ── Fallback: regular Node.js API + simulated streaming ───────────────────
    await _simulatedStream(
      message,
      productType,
      sessionId,
      callbacks,
      setState,
      textRef,
      agentRef,
      abortRef,
    );
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, phase: "idle" }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    textRef.current = "";
    setState(IDLE);
  }, []);

  return { state, stream, cancel, reset };
}

// ── Simulated streaming fallback ──────────────────────────────────────────────

async function _simulatedStream(
  message: string,
  productType: string,
  sessionId: string,
  callbacks: StreamCallbacks | undefined,
  setState: React.Dispatch<React.SetStateAction<StreamState>>,
  textRef: React.MutableRefObject<string>,
  agentRef: React.MutableRefObject<{ agentName: string; agentDomain: string; transferred: boolean; transferFrom: string | null; transferTo: string | null; transferToName: string | null; sessionId: string }>,
  abortRef: React.MutableRefObject<AbortController | null>,
) {
  const domainKey = productType in FALLBACK_STEPS ? productType : "health";
  const steps = FALLBACK_STEPS[domainKey] || FALLBACK_STEPS.health;

  // Phase 1: Show thinking steps while waiting for API
  const apiPromise = _callNodeApi(message, productType, sessionId);

  for (const step of steps) {
    if (abortRef.current?.signal.aborted) return;
    setState(prev => ({
      ...prev,
      phase: "thinking",
      thinkingStep: step,
      thinkingHistory: [...prev.thinkingHistory, step],
    }));
    callbacks?.onThinking?.(step);
    await _sleep(340);
  }

  // Phase 2: Await API result
  let apiResult: { reply: string; agentName: string; agentDomain: string; transferred: boolean; sessionId: string } | null = null;
  try {
    apiResult = await apiPromise;
  } catch {}

  const reply = apiResult?.reply || "I'm having a little trouble right now. Could you try again in a moment?";
  const newAgentName = apiResult?.agentName || agentRef.current.agentName;
  const newDomain = apiResult?.agentDomain || agentRef.current.agentDomain;
  const newSessionId = apiResult?.sessionId || sessionId;

  agentRef.current = { ...agentRef.current, agentName: newAgentName, agentDomain: newDomain, sessionId: newSessionId };

  setState(prev => ({
    ...prev,
    phase: "streaming",
    text: "",
    agentName: newAgentName,
    agentDomain: newDomain,
    sessionId: newSessionId,
  }));
  callbacks?.onAgentInfo?.({ agentName: newAgentName, agentDomain: newDomain, transferred: !!apiResult?.transferred, suggestTransfer: false, isInterrupt: false, transferFrom: null, transferTo: null, transferToName: null, transferReason: null, previousAgent: null, sessionId: newSessionId });

  // Phase 3: Animate text reveal
  const words = reply.split(" ");
  let accumulated = "";
  for (let i = 0; i < words.length; i += 2) {
    if (abortRef.current?.signal.aborted) return;
    const chunk = words.slice(i, i + 2).join(" ");
    accumulated += (i > 0 ? " " : "") + chunk;
    textRef.current = accumulated;
    setState(prev => ({ ...prev, text: accumulated }));
    callbacks?.onToken?.(accumulated);
    await _sleep(28);
  }

  setState(prev => ({ ...prev, phase: "done" }));
  callbacks?.onDone?.({
    text: accumulated,
    ...agentRef.current,
    suggestTransfer: false,
    transferReason: null,
    previousAgent: null,
  });
}

// NOTE: the Node bridge keeps its own session memory, so this path deliberately
// sends only the session id — no client-side history or user name.
async function _callNodeApi(
  message: string,
  productType: string,
  sessionId: string,
): Promise<{ reply: string; agentName: string; agentDomain: string; transferred: boolean; sessionId: string }> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers,
    // Auth is carried by the httpOnly cookie, so include credentials.
    credentials: "include",
    body: JSON.stringify({
      message,
      product_type: productType,
      session_id: sessionId,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return {
    reply: data.data?.advisorMessage?.message || "",
    agentName: data.data?.agentName || "Sarah AI",
    agentDomain: productType || "health",
    transferred: !!data.data?.transferred,
    sessionId: data.data?.sessionId || sessionId,
  };
}

function _sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
