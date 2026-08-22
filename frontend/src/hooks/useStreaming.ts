"use client";
import { logger } from "@/lib/logger";
import { useState, useCallback, useRef } from "react";
import type { VoiceRequestMeta } from "@/lib/voiceStyle";

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

/**
 * What the turn cost, measured where it is actually felt.
 *
 * `firstTokenMs` is the number that matters on the voice path: it is how long
 * the customer sits in silence after they stop speaking. Before real streaming
 * it was not a separate number from `totalMs` — there was nothing to say until
 * everything had been said.
 */
export interface StreamLatency {
  /** Whether real model tokens were streamed, or the reply was replayed. */
  streamed: boolean;
  totalMs: number;
  firstTokenMs: number | null;
  droppedTokens: number;
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
    /**
     * Where the middleware put this turn, on a spoken turn only.
     *
     * The engine's existing 9-state conversation machine, read rather than
     * duplicated — there is no second state machine in the browser to keep in
     * sync with it. Null on a typed turn, which sends no voice context.
     */
    conversationState?: string | null;
    intent?: string | null;
  }) => void;
  onToken?: (accumulated: string) => void;
  /**
   * The turn diverged from what was already streamed, and this is the truth.
   *
   * Raised when the model died part-way and the agent answered in its own voice
   * instead, so the words already on screen are no longer what this turn says.
   * A caller that is only rendering text can ignore it — `text` is corrected
   * either way — but a caller that is *speaking* has to stop and start again.
   */
  onReplace?: (text: string) => void;
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
    /** How the turn actually performed. Absent on the fallback path. */
    latency?: StreamLatency | null;
  }) => void;
  onTransferSuggested?: (info: TransferSuggestion) => void;
  onInterruptSuggested?: (info: InterruptSuggestion) => void;
  onError?: (message: string) => void;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

/**
 * The latency block off a `done` event, read defensively.
 *
 * The field is additive and an older engine will not send it, so its absence is
 * ordinary rather than an error — and a measurement that arrived malformed must
 * never be the thing that breaks a reply the customer already has.
 */
function readLatency(raw: unknown): StreamLatency | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  return {
    streamed: value.streamed === true,
    totalMs: typeof value.total_ms === "number" ? value.total_ms : 0,
    firstTokenMs: typeof value.first_token_ms === "number" ? value.first_token_ms : null,
    droppedTokens: typeof value.dropped_tokens === "number" ? value.dropped_tokens : 0,
  };
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
    // The engine's own conversation stage, echoed back on a spoken turn only.
    conversationState: null as string | null, intent: null as string | null,
  });

  /**
   * Which request the reader is allowed to speak for.
   *
   * `cancel()` aborts the fetch, but a chunk already decoded and sitting in a
   * microtask still runs its handlers, and a new turn started in the same tick
   * would have its state overwritten by the old one's tokens. Abort stops the
   * *transport*; this stops the *events*, which is the half that reaches the
   * customer.
   */
  const generationRef = useRef(0);

  const stream = useCallback(async (
    message: string,
    history: ChatHistoryItem[],
    productType: string,
    sessionId: string,
    callbacks?: StreamCallbacks,
    forceTransferTo?: string,
    declinedDomains?: string[],
    /**
     * How the customer spoke this turn, when they spoke it.
     *
     * Absent for every typed message, which is what keeps typed chat provably
     * unchanged: no block, no adaptation, the same request body as before. It
     * controls how the reply is worded and reaches nothing that decides what
     * the reply says.
     */
    voice?: VoiceRequestMeta | null,
  ) => {
    // Cancel any in-progress request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    textRef.current = "";
    agentRef.current = {
      agentName: "Sarah AI", agentDomain: productType || "health",
      transferred: false, suggestTransfer: false, isInterrupt: false,
      transferFrom: null, transferTo: null, transferToName: null,
      transferReason: null, previousAgent: null, sessionId,
      conversationState: null, intent: null,
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
          ...(voice ? { voice } : {}),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new AdvisorError(res.status);

      sseSucceeded = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          // Superseded or cancelled while this batch was being decoded. The
          // events are dropped here rather than at the reader, because by the
          // time a chunk has been parsed the abort has already lost the race.
          if (generationRef.current !== generation) return;
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
                conversationState: ev.conversation_state ?? null,
                intent:            ev.intent ?? null,
              };
              setState(prev => ({
                ...prev,
                phase: "streaming",
                // Clearing the bubble is right when this event is what starts
                // the reply — which it always was, because metadata only
                // existed once the whole turn had finished. With real
                // streaming the authoritative metadata arrives *after* the
                // words, and wiping the text there would blank a reply the
                // customer is already reading, and already hearing.
                ...(textRef.current ? {} : { text: "" }),
                ...agentRef.current,
              }));
              callbacks?.onAgentInfo?.(agentRef.current);

            } else if (ev.type === "token") {
              textRef.current += ev.text || "";
              const t = textRef.current;
              setState(prev => ({ ...prev, text: t }));
              callbacks?.onToken?.(t);

            } else if (ev.type === "replace") {
              // Not an append. What was streamed is being retracted, so the
              // accumulator is replaced rather than added to — otherwise the
              // retracted half stays on screen above its own correction.
              const corrected = ev.text || "";
              textRef.current = corrected;
              setState(prev => ({ ...prev, text: corrected }));
              callbacks?.onReplace?.(corrected);

            } else if (ev.type === "done") {
              const finalSessionId = ev.session_id || agentRef.current.sessionId;
              agentRef.current.sessionId = finalSessionId;
              setState(prev => ({ ...prev, phase: "done", sessionId: finalSessionId }));
              callbacks?.onDone?.({
                text: textRef.current,
                ...agentRef.current,
                sessionId: finalSessionId,
                latency: readLatency(ev.latency),
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
    // Orphan the events as well as the socket. Without this, a reply the
    // customer has just cut into can still paint itself onto the screen.
    generationRef.current += 1;
    setState(prev => ({ ...prev, phase: "idle" }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    generationRef.current += 1;
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
  let failure: unknown = null;
  try {
    apiResult = await apiPromise;
  } catch (error) {
    // Recorded rather than discarded. An empty catch here turned every failure
    // into one identical sentence: a signed-out customer was told the AI was
    // having trouble, so they waited instead of signing in — and it told us the
    // same, which cost an investigation into a service that was working.
    failure = error;
    logger.warn("advisor: request failed", error);
  }

  const reply = apiResult?.reply || _advisorFallback(failure);
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
/** A failed advisor call, carrying the status so the cause can be named. */
export class AdvisorError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "AdvisorError";
    this.status = status;
  }
}

/**
 * What to say when the advisor could not answer.
 *
 * Distinguishing the causes matters more here than anywhere else in the app.
 * "I'm having a little trouble" told a signed-out customer that the AI was
 * broken, so they waited instead of signing in — and it told us the same, which
 * cost an investigation into a working AI service.
 */
export function _advisorFallback(failure: unknown): string {
  const status = failure instanceof AdvisorError ? failure.status : 0;

  if (status === 401 || status === 403) {
    return "Please sign in to continue this conversation — your chat history is kept with your account.";
  }
  if (status === 429) {
    return "That was a lot of questions at once. Give it a moment and ask again.";
  }
  if (status >= 500) {
    return "Something went wrong on our side. Please try again in a moment.";
  }
  return "I could not reach Aegis just now. Check your connection and try again.";
}

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

  // The status is carried, not just described: a 401 is "please sign in" and a
  // 500 is "we are broken", and the caller cannot tell them apart from a
  // message string alone.
  if (!res.ok) throw new AdvisorError(res.status);
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
