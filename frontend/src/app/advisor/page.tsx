"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Heart, Car, Plane, Home as HomeIcon } from "lucide-react";
import { type ChatMsg, type RecommendationData } from "@/components/ChatMessage";
import TransferDialog from "@/components/TransferDialog";
import InterruptDialog from "@/components/InterruptDialog";
import { useStreaming, type ChatHistoryItem } from "@/hooks/useStreaming";
import { uiActionService } from "@/services/api";

// ── Advisor roster (shared) & page-local helpers ─────────────────────────────
import {
  ADVISORS,
  AGENT_NAME_TO_CATEGORY,
  type AdvisorKey,
} from "@/lib/advisors";
import {
  now,
  makeId,
  loadAgentHistory,
  saveAgentHistory,
  clearAgentHistory,
} from "./history";
import { resolveAgentNameForDomain } from "./transferRules";
import { useAdvisorTransfer } from "./useAdvisorTransfer";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorSidebar from "@/components/advisor/AdvisorSidebar";
import { AdvisorBackdrop } from "@/components/advisor/AdvisorBackdrop";
import { MessageTranscript } from "@/components/advisor/MessageTranscript";
import { ChatComposer } from "@/components/advisor/ChatComposer";
import { SuggestedQuestions } from "@/components/advisor/SuggestedQuestions";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestedQuestions";
import { LeadFormModal } from "@/components/advisor/LeadFormModal";

// ── Component ──────────────────────────────────────────────────────────────────

function AdvisorChat() {
  const searchParams = useSearchParams();

  const getInitialCategory = (): AdvisorKey => {
    const bot = (searchParams.get("bot") || "").toLowerCase();
    const cat = (searchParams.get("category") || "").toLowerCase();
    if (bot === "alex" || cat === "motor" || cat === "car") return "motor";
    if (bot === "sarah" || cat === "health" || cat === "family") return "health";
    if (bot === "ethan" || cat === "travel") return "travel";
    if (bot === "emma" || cat === "property" || cat === "home") return "property";
    if (bot === "sri" || cat === "miscellaneous" || cat === "cyber" || cat === "executive") return "miscellaneous";
    return "miscellaneous";
  };

  const [activeCategory, setActiveCategory] = useState<AdvisorKey>(getInitialCategory());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const [pingSpeed, setPingSpeed] = useState("45ms");
  const [activeHandshakes, setActiveHandshakes] = useState(128);
  const [envResponseTimeMs, setEnvResponseTimeMs] = useState<number | undefined>(undefined);

  // Agent-handoff state & rules (dialogs, declined domains, one-shot flags)
  const transfer = useAdvisorTransfer();
  const { transferRequest, interruptRequest, connectingTo, previousAdvisorCategory } = transfer;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingTimestampRef = useRef("");
  const lastUserMsgRef = useRef("");
  // Allow sendToAdvisor to read latest messages without stale closure
  const conversationRef = useRef<ChatMsg[]>([]);
  conversationRef.current = messages;

  const { state: streamState, stream, cancel: cancelStream } = useStreaming();

  const advisor = ADVISORS[activeCategory];
  const isStreaming = streamState.phase === "thinking" || streamState.phase === "streaming";

  // Streaming advisor config (may differ from sidebar if agent transferred)
  const streamingCategory = AGENT_NAME_TO_CATEGORY[streamState.agentName] || activeCategory;
  const streamingAdvisor = ADVISORS[streamingCategory];

  // ── Simulated ping HUD ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setPingSpeed(`${Math.floor(Math.random() * 15 + 38)}ms`);
      setActiveHandshakes(prev => Math.max(120, Math.min(145, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // ── Load agent history from localStorage on agent switch ──────────────────
  useEffect(() => {
    cancelStream();
    const domain = ADVISORS[activeCategory].pythonDomain;
    const adv = ADVISORS[activeCategory];
    const stored = loadAgentHistory(domain);
    if (stored) {
      setMessages(stored);
    } else {
      setMessages([{
        id: "intro",
        sender: "advisor" as const,
        text: adv.intro,
        timestamp: now(),
        agentName: adv.name,
        agentDomain: domain,
      }]);
    }
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save messages to localStorage whenever they change ────────────────
  useEffect(() => {
    if (messages.length > 0) {
      const domain = ADVISORS[activeCategory].pythonDomain;
      saveAgentHistory(domain, messages);
    }
  }, [messages, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle ?selectPlan URL param ──────────────────────────────────────────
  useEffect(() => {
    const p = searchParams.get("selectPlan");
    if (p) setSelectedPlan(decodeURIComponent(p));
  }, [searchParams]);

  // Auto-scroll is owned by MessageTranscript's useStickyScroll (it re-pins to
  // the newest message only while the reader is already at the bottom).

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [inputVal]);

  // ── Core send ─────────────────────────────────────────────────────────────
  const sendToAdvisor = useCallback(async (userMsg: string) => {
    if (!userMsg.trim()) return;
    lastUserMsgRef.current = userMsg;

    const msgId = makeId();
    const ts = now();
    streamingTimestampRef.current = ts;

    setMessages(prev => [
      ...prev,
      { id: msgId, sender: "user", text: userMsg, timestamp: ts },
    ]);

    const sessionId =
      (typeof window !== "undefined" && localStorage.getItem("aegis_session_id")) || "";

    // Consume the one-shot forced transfer queued by the confirm/return actions
    const { forceTransferTo } = transfer.consumePending();

    // Build history from current conversation (exclude just-added user msg)
    const history: ChatHistoryItem[] = conversationRef.current
      .slice(-10)
      .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

    const addErrorMsg = () => {
      setMessages(prev => [
        ...prev,
        {
          id: makeId(),
          sender: "advisor" as const,
          text: "I'm having a little trouble connecting right now. Please try again in a moment — I'm still here!",
          timestamp: now(),
          agentName: ADVISORS[activeCategory].name,
        },
      ]);
    };

    try {
      await stream(
        userMsg,
        history,
        ADVISORS[activeCategory].pythonDomain,
        sessionId,
        {
          onAgentInfo: (info) => {
            transfer.dismissConnecting(); // stream is live — dismiss connecting overlay
            streamingTimestampRef.current = now();
            if (info.sessionId && typeof window !== "undefined") {
              localStorage.setItem("aegis_session_id", info.sessionId);
            }
            // Capture env_metadata response time if present
            const meta = (info as Record<string, unknown>).env_metadata;
            if (meta && typeof meta === "object") {
              const rt = (meta as Record<string, unknown>).response_time_ms;
              if (typeof rt === "number") setEnvResponseTimeMs(rt);
            }
          },
          onInterruptSuggested: (info) => {
            // Mid-workflow domain switch detected — show specialized dialog
            transfer.suggestInterrupt(info, activeCategory);
          },
          onDone: (result) => {
            if (result.sessionId && typeof window !== "undefined") {
              localStorage.setItem("aegis_session_id", result.sessionId);
            }

            if (result.transferred && result.agentName) {
              // Switch sidebar to new agent
              const newCat = AGENT_NAME_TO_CATEGORY[result.agentName];
              if (newCat) {
                setActiveCategory(newCat);
                // Save full conversation (including transfer message) to new agent's history
                const newDomain = ADVISORS[newCat].pythonDomain;
                saveAgentHistory(newDomain, [...conversationRef.current, {
                  id: makeId(),
                  sender: "advisor" as const,
                  text: result.text,
                  timestamp: streamingTimestampRef.current || now(),
                  agentName: result.agentName || ADVISORS[activeCategory].name,
                  agentDomain: result.agentDomain || ADVISORS[activeCategory].pythonDomain,
                  transferred: result.transferred,
                }]);
              }
              // Enable "return to previous advisor" button
              if (result.previousAgent) {
                transfer.recordPreviousAgent(result.previousAgent);
              }
            }

            setMessages(prev => [
              ...prev,
              {
                id: makeId(),
                sender: "advisor" as const,
                text: result.text,
                timestamp: streamingTimestampRef.current || now(),
                agentName: result.agentName || ADVISORS[activeCategory].name,
                agentDomain: result.agentDomain || ADVISORS[activeCategory].pythonDomain,
                transferred: result.transferred,
                transferFromName: result.transferFrom
                  ? resolveAgentNameForDomain(result.transferFrom)
                  : undefined,
                transferToName: result.transferred ? (result.agentName || undefined) : undefined,
              },
            ]);

            setSpeakText(result.text);
          },
          onTransferSuggested: (info) => {
            transfer.suggestTransfer(info, activeCategory);
          },
          onError: () => addErrorMsg(),
        },
        forceTransferTo,
        transfer.getDeclinedDomains(),
      );
    } catch {
      addErrorMsg();
    }
  }, [activeCategory, stream]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const msg = inputVal.trim();
    if (!msg) return;
    setInputVal("");
    await sendToAdvisor(msg);
  }, [inputVal, sendToAdvisor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Transfer dialog handlers ──────────────────────────────────────────────
  const handleTransferConfirm = useCallback(() => {
    const prompt = transfer.confirmTransfer(lastUserMsgRef.current);
    if (prompt) sendToAdvisor(prompt);
  }, [transfer, sendToAdvisor]);

  const handleTransferDecline = useCallback(() => {
    // Current agent acknowledges and stays (Rule 4)
    const reply = transfer.declineTransfer();
    if (!reply) return;
    setMessages(prev => [
      ...prev,
      { id: makeId(), sender: "advisor" as const, timestamp: now(), ...reply },
    ]);
  }, [transfer]);

  // ── Interrupt dialog handlers ─────────────────────────────────────────────
  const handleInterruptConfirm = useCallback(() => {
    const prompt = transfer.confirmInterrupt(lastUserMsgRef.current);
    if (prompt) sendToAdvisor(prompt);
  }, [transfer, sendToAdvisor]);

  const handleInterruptDecline = useCallback(() => {
    const reply = transfer.declineInterrupt();
    if (!reply) return;
    setMessages(prev => [
      ...prev,
      { id: makeId(), sender: "advisor" as const, timestamp: now(), ...reply },
    ]);
  }, [transfer]);

  const handleReturnToPrevious = useCallback(() => {
    const prompt = transfer.returnToPrevious();
    if (prompt) sendToAdvisor(prompt);
  }, [transfer, sendToAdvisor]);

  const handleOptionClick = useCallback(async (text: string) => {
    await sendToAdvisor(text);
  }, [sendToAdvisor]);

  const handleRegenerate = useCallback(async (_msgId: string) => {
    if (lastUserMsgRef.current) await sendToAdvisor(lastUserMsgRef.current);
  }, [sendToAdvisor]);

  const handleVoicePlay = useCallback((text: string) => {
    setSpeakText(text);
  }, []);

  const handleNewChat = useCallback(() => {
    const domain = ADVISORS[activeCategory].pythonDomain;
    clearAgentHistory(domain);
    const adv = ADVISORS[activeCategory];
    setMessages([{
      id: "intro",
      sender: "advisor" as const,
      text: adv.intro,
      timestamp: now(),
      agentName: adv.name,
      agentDomain: domain,
    }]);
  }, [activeCategory]);

  const handleUIAction = useCallback(async (action: string, planData: RecommendationData) => {
    localStorage.setItem("selectedPlanDetails", JSON.stringify(planData));

    let sessionId =
      (typeof window !== "undefined" && localStorage.getItem("aegis_session_id")) || "";
    if (!sessionId) {
      sessionId = makeId();
      localStorage.setItem("aegis_session_id", sessionId);
    }

    const pd = planData as unknown as Record<string, unknown>;

    if (action === "view_details") {
      uiActionService.dispatch({ action, session_id: sessionId, session_data: pd }).catch(() => {});
      window.location.href = "/policies/details";
      return;
    }

    if (action === "compare_plans") {
      uiActionService.dispatch({ action, session_id: sessionId, session_data: pd }).catch(() => {});
      window.location.href = "/policies/details?compare=true";
      return;
    }

    if (action === "select_plan" || action === "purchase_plan") {
      try {
        await uiActionService.dispatch({ action, session_id: sessionId, session_data: pd });
      } catch {}
      window.location.href = "/purchase/verify";
      return;
    }

    setSelectedPlan(planData?.planName || "Selected Plan");
  }, []);

  // Names come from the roster; the icon and sub-label are sidebar-only copy.
  const sidebarAdvisors: { id: AdvisorKey; icon: React.ReactNode; label: string; sub: string }[] = (
    [
      { id: "miscellaneous", icon: <Shield className="w-4 h-4" />,   sub: "Executive Risk" },
      { id: "motor",         icon: <Car className="w-4 h-4" />,      sub: "Vehicle Asset"  },
      { id: "health",        icon: <Heart className="w-4 h-4" />,    sub: "Health Floater" },
      { id: "travel",        icon: <Plane className="w-4 h-4" />,    sub: "Global Passage" },
      { id: "property",      icon: <HomeIcon className="w-4 h-4" />, sub: "Real Estate"    },
    ] as const
  ).map(a => ({ ...a, label: ADVISORS[a.id].name }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-slate-950 flex flex-col z-50 select-none touch-none">

      <AdvisorBackdrop glowColor={advisor.glowColor} />

      <AdvisorHeader
        advisor={advisor}
        isStreaming={isStreaming}
        streamAgentName={streamState.agentName}
        streamAgentDomain={streamState.agentDomain}
        streamPhase={streamState.phase}
        envResponseTimeMs={envResponseTimeMs}
        pingSpeed={pingSpeed}
      />

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex gap-6 overflow-hidden z-30 relative pointer-events-auto">

        <AdvisorSidebar
          sidebarAdvisors={sidebarAdvisors}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          handleNewChat={handleNewChat}
          isStreaming={isStreaming}
          activeHandshakes={activeHandshakes}
        />

        {/* ── CHAT PANEL ───────────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col rounded-[32px] border overflow-hidden h-full transition-all duration-500 bg-slate-900/40 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/8 ${advisor.borderGlow} pointer-events-auto`}>

          <MessageTranscript
            connectingTo={connectingTo}
            messages={messages}
            advisor={advisor}
            streamingAdvisor={streamingAdvisor}
            streamState={streamState}
            streamingTimestamp={streamingTimestampRef.current || now()}
            onUIAction={handleUIAction}
            onOptionClick={handleOptionClick}
            onRegenerate={handleRegenerate}
            onVoicePlay={handleVoicePlay}
          />

          {/* Starter chips: only before the user's first turn. Routes through the
              existing send path — no streaming/voice logic touched. */}
          {!isStreaming && !connectingTo && !messages.some((m) => m.sender === "user") && (
            <SuggestedQuestions
              questions={SUGGESTED_QUESTIONS[activeCategory]}
              onSelect={(q) => sendToAdvisor(q)}
            />
          )}

          <ChatComposer
            previousAdvisorCategory={previousAdvisorCategory}
            onReturnToPrevious={handleReturnToPrevious}
            isStreaming={isStreaming}
            onSubmit={handleSend}
            onFinalTranscript={(text) => {
              setInputVal(text);
              setTimeout(() => sendToAdvisor(text), 0);
            }}
            speakText={speakText}
            onSpeakEnd={() => setSpeakText(null)}
            voiceAgentDomain={streamState.agentDomain || advisor.pythonDomain}
            textareaRef={textareaRef}
            inputVal={inputVal}
            onInputChange={setInputVal}
            onKeyDown={handleKeyDown}
            placeholder={advisor.placeholder}
          />
        </div>
      </div>

      {/* ── TRANSFER PERMISSION DIALOG ───────────────────────────────────────── */}
      <TransferDialog
        request={transferRequest}
        onConfirm={handleTransferConfirm}
        onDecline={handleTransferDecline}
      />

      {/* ── INTERRUPT DIALOG (mid-workflow domain switch) ─────────────────────── */}
      <InterruptDialog
        request={interruptRequest}
        onConfirm={handleInterruptConfirm}
        onDecline={handleInterruptDecline}
      />

      {/* ── LEAD FORM MODAL ──────────────────────────────────────────────────── */}
      <LeadFormModal planName={selectedPlan} onClose={() => setSelectedPlan(null)} />
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-rose-600 border-t-transparent animate-spin" />
      </div>
    }>
      <AdvisorChat />
    </Suspense>
  );
}
