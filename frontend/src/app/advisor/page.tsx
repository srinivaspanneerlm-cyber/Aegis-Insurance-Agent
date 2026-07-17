"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Shield, Heart, Car, Plane, Home as HomeIcon, X, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import LeadForm from "@/components/LeadForm";
import ChatMessage, { type ChatMsg, type RecommendationData } from "@/components/ChatMessage";
import ThinkingEngine from "@/components/ThinkingEngine";
import VoiceEngine from "@/components/VoiceEngine";
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

// ── Component ──────────────────────────────────────────────────────────────────

function AdvisorChat() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

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

  const chatEndRef = useRef<HTMLDivElement>(null);
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

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, [messages, streamState.text, streamState.phase]);

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
        user?.name || "there",
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
  }, [activeCategory, user?.name, stream]); // eslint-disable-line react-hooks/exhaustive-deps

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

      <style jsx global>{`
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>

      {/* Cyber grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none opacity-50 z-0" />

      {/* Ambient glow */}
      <div
        style={{ background: `radial-gradient(circle, ${advisor.glowColor} 0%, rgba(0,0,0,0) 70%)` }}
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0 transition-all duration-700"
      />
      <div className="absolute bottom-[10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none z-0" />

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

          {/* Message stream */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-5 chat-scroll relative touch-pan-y" style={{ scrollbarWidth: "thin" }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.01),transparent_50%)] pointer-events-none" />

            {/* Connecting overlay — shown instantly after YES, dismissed on first SSE event */}
            <AnimatePresence>
              {connectingTo && (
                <motion.div
                  key="connecting-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center"
                  style={{ background: "rgba(1, 4, 16, 0.9)", backdropFilter: "blur(16px)" }}
                >
                  <motion.div
                    initial={{ scale: 0.82, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.88, y: 12, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 24 }}
                    className="flex flex-col items-center gap-6 w-full max-w-[260px]"
                  >
                    {/* Agent avatar — layered rings */}
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        className="absolute rounded-3xl"
                        style={{
                          width: 88, height: 88,
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 26,
                        }}
                        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.div
                        className="absolute rounded-3xl"
                        style={{
                          width: 72, height: 72,
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 22,
                        }}
                        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                      />
                      <div
                        className={`w-14 h-14 rounded-[18px] bg-gradient-to-tr ${connectingTo.theme} text-white font-black text-lg flex items-center justify-center shadow-2xl relative z-10`}
                      >
                        {connectingTo.avatar}
                      </div>
                    </div>

                    {/* Label */}
                    <div className="text-center">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                        Establishing Secure Channel
                      </p>
                      <div className="flex items-baseline gap-1.5 justify-center">
                        <p className="text-[15px] font-black text-white leading-none">
                          Connecting to {connectingTo.name}
                        </p>
                        <span className="flex gap-0.5 pb-0.5">
                          {[0, 1, 2].map(i => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 rounded-full bg-white/70 inline-block"
                              animate={{ opacity: [0.2, 1, 0.2] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </span>
                      </div>
                    </div>

                    {/* Step progress */}
                    <div className="w-full flex flex-col gap-2">
                      {[
                        { label: "Saving session context", delay: 0 },
                        { label: "Routing to specialist", delay: 0.28 },
                        { label: "Establishing connection", delay: 0.56 },
                        { label: "Ready", delay: 0.82 },
                      ].map(({ label, delay }) => (
                        <motion.div
                          key={label}
                          className="flex items-center gap-2.5"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay, duration: 0.3 }}
                        >
                          <motion.div
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gradient-to-tr ${connectingTo.theme}`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: delay + 0.1, type: "spring", stiffness: 260, damping: 18 }}
                          />
                          <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div
                      className="w-full h-px rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${connectingTo.theme}`}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Finalized messages */}
            {messages.map(m => (
              <ChatMessage
                key={m.id}
                message={m}
                advisorAvatar={
                  m.sender === "advisor"
                    ? (AGENT_NAME_TO_CATEGORY[m.agentName || ""] ? ADVISORS[AGENT_NAME_TO_CATEGORY[m.agentName || ""]].avatar : advisor.avatar)
                    : advisor.avatar
                }
                advisorTheme={
                  m.sender === "advisor"
                    ? (AGENT_NAME_TO_CATEGORY[m.agentName || ""] ? ADVISORS[AGENT_NAME_TO_CATEGORY[m.agentName || ""]].theme : advisor.theme)
                    : advisor.theme
                }
                onUIAction={handleUIAction}
                onOptionClick={handleOptionClick}
                onRegenerate={m.sender === "advisor" ? handleRegenerate : undefined}
                onVoicePlay={m.sender === "advisor" ? handleVoicePlay : undefined}
              />
            ))}

            {/* ThinkingEngine — shown during thinking phase */}
            <ThinkingEngine
              active={streamState.phase === "thinking"}
              currentStep={streamState.thinkingStep}
              thinkingHistory={streamState.thinkingHistory}
              agentName={streamingAdvisor.name}
              agentDomain={streamState.agentDomain || advisor.pythonDomain}
              advisorAvatar={streamingAdvisor.avatar}
              advisorTheme={streamingAdvisor.theme}
            />

            {/* Streaming message — shown during streaming phase */}
            {streamState.phase === "streaming" && streamState.text && (
              <ChatMessage
                message={{
                  id: "streaming",
                  sender: "advisor",
                  text: streamState.text,
                  timestamp: streamingTimestampRef.current || now(),
                  agentName: streamState.agentName || advisor.name,
                  agentDomain: streamState.agentDomain,
                  transferred: streamState.transferred,
                  isStreaming: true,
                }}
                advisorAvatar={streamingAdvisor.avatar}
                advisorTheme={streamingAdvisor.theme}
                onUIAction={handleUIAction}
                onOptionClick={handleOptionClick}
              />
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── INPUT AREA ─────────────────────────────────────────────────── */}
          <div className="p-4 border-t border-white/5 bg-slate-950/40 relative z-10 select-none flex-shrink-0">

            {/* Return to Previous Advisor pill (Rule 6) */}
            <AnimatePresence>
              {previousAdvisorCategory && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-center mb-3"
                >
                  <button
                    onClick={handleReturnToPrevious}
                    disabled={isStreaming}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 touch-manipulation disabled:opacity-40"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(148,163,184,1)",
                    }}
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Return to {ADVISORS[previousAdvisorCategory].name}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSend} className="flex items-end gap-3">

              {/* Voice engine */}
              <div className="flex-shrink-0 pb-1">
                <VoiceEngine
                  onFinalTranscript={(text) => {
                    setInputVal(text);
                    setTimeout(() => sendToAdvisor(text), 0);
                  }}
                  speakText={speakText}
                  onSpeakEnd={() => setSpeakText(null)}
                  agentDomain={streamState.agentDomain || advisor.pythonDomain}
                  disabled={isStreaming}
                  autoSpeak={false}
                />
              </div>

              {/* Auto-resize textarea */}
              <div className="flex-grow relative select-text touch-auto">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={advisor.placeholder}
                  disabled={isStreaming}
                  className="w-full py-3.5 pl-5 pr-4 rounded-[22px] border outline-none text-xs font-semibold transition-all resize-none leading-relaxed bg-slate-950/65 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:bg-slate-950 shadow-inner disabled:opacity-50"
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                />
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={!inputVal.trim() || isStreaming}
                className="p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:scale-100 active:scale-95 touch-manipulation select-none bg-white text-slate-950 hover:bg-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-px"
              >
                <Send className="w-4 h-4 stroke-[2.2]" />
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
              <span>🔐 Pipeline V3.8</span>
              <span className="hidden sm:inline">Conversations are private &amp; secure</span>
              <span>Cleared: IRDAI-MOCK</span>
            </div>
          </div>
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
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              className="w-full max-w-lg relative bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-left pointer-events-auto"
            >
              <button
                onClick={() => setSelectedPlan(null)}
                className="absolute right-5 top-5 z-10 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer active:scale-95 touch-manipulation select-none"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
              <div className="p-3 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <LeadForm initialPlanSelection={selectedPlan} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
