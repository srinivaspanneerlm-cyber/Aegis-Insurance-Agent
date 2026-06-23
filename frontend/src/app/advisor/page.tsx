"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Send, Mic, Shield, Heart, Car, Plane,
  Home as HomeIcon, X, ShieldCheck, Zap, Star, ShieldAlert,
  ChevronRight, MicOff, Volume2, Bot, Layers, User, Cpu, Lock, Activity, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import LeadForm from "@/components/LeadForm";
import AIChatMessage from "@/components/AIChatMessage";
import { useTheme } from "@/context/ThemeContext";
import { chatService } from "@/services/api";

const ADVISORS = {
  motor: {
    name: "Alex AI",
    title: "Vehicle Protection Advisor",
    avatar: "A",
    emoji: "🚗",
    theme: "from-blue-600 to-cyan-500",
    glowColor: "rgba(6, 182, 212, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(6,182,212,0.12)] border-cyan-500/20",
    activeTab: "bg-cyan-500/10 border-cyan-400/35 text-cyan-300",
    accentBg: "bg-cyan-500/10",
    accentText: "text-cyan-400",
    intro: "Hey there! 👋\n\nI'm Alex, your vehicle protection advisor at Aegis.\n\nI'm here to help you find the right cover for your car or bike — something that actually makes sense for how you drive and what matters to you.\n\nTo get started: what vehicle are we protecting today?",
    placeholder: "Tell Alex about your vehicle...",
    thinkingMessages: [
      "Checking coverage options for you…",
      "Finding the right plan for your car…",
      "Reviewing your protection needs…",
    ],
  },
  health: {
    name: "Sarah AI",
    title: "Family Health Advisor",
    avatar: "S",
    emoji: "❤️",
    theme: "from-emerald-600 to-teal-500",
    glowColor: "rgba(16, 185, 129, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(16,185,129,0.12)] border-emerald-500/20",
    activeTab: "bg-emerald-500/10 border-emerald-400/35 text-emerald-300",
    accentBg: "bg-emerald-500/10",
    accentText: "text-emerald-400",
    intro: "Hello! 👋\n\nI'm Sarah, your family health advisor at Aegis.\n\nHealth insurance can feel complicated, but I'm here to make it simple. Together, we'll find a plan that truly protects your family without any surprises.\n\nWho are we looking to protect today?",
    placeholder: "Ask Sarah about health plans for your family...",
    thinkingMessages: [
      "Looking at the best options for your family…",
      "Reviewing health plans that fit your needs…",
      "Preparing your personalized recommendation…",
    ],
  },
  travel: {
    name: "Ethan AI",
    title: "Travel Protection Advisor",
    avatar: "E",
    emoji: "✈️",
    theme: "from-violet-600 to-purple-500",
    glowColor: "rgba(139, 92, 246, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(139, 92, 246, 0.12)] border-purple-500/20",
    activeTab: "bg-purple-500/10 border-purple-400/35 text-purple-300",
    accentBg: "bg-purple-500/10",
    accentText: "text-purple-400",
    intro: "Hey, welcome! ✈️\n\nI'm Ethan, your travel protection advisor at Aegis.\n\nWhether it's a weekend trip or an international adventure, I'll make sure you're covered for everything that could go wrong — so you can actually enjoy the journey.\n\nWhere are you planning to travel?",
    placeholder: "Tell Ethan about your travel plans...",
    thinkingMessages: [
      "Checking coverage for your destination…",
      "Finding the right travel plan for you…",
      "Reviewing what you'd need on this trip…",
    ],
  },
  property: {
    name: "Emma AI",
    title: "Home Protection Advisor",
    avatar: "E",
    emoji: "🏡",
    theme: "from-amber-600 to-orange-500",
    glowColor: "rgba(245, 158, 11, 0.22)",
    borderGlow: "shadow-[0_0_25px_rgba(245, 158, 11, 0.12)] border-amber-500/20",
    activeTab: "bg-amber-500/10 border-amber-400/35 text-amber-300",
    accentBg: "bg-amber-500/10",
    accentText: "text-amber-400",
    intro: "Welcome! 🏡\n\nI'm Emma, your home protection advisor at Aegis.\n\nYour home is one of the most important things you'll ever protect. I'm here to make that easy and make sure your belongings, electronics, and space are properly covered.\n\nDo you own your home or are you renting?",
    placeholder: "Ask Emma about protecting your home...",
    thinkingMessages: [
      "Looking at coverage options for your home…",
      "Reviewing what would work best for you…",
      "Preparing your home protection recommendation…",
    ],
  },
  miscellaneous: {
    name: "Sri AI",
    title: "Executive Risk Advisor",
    avatar: "SR",
    emoji: "💼",
    theme: "from-rose-600 to-pink-500",
    glowColor: "rgba(244, 63, 94, 0.35)",
    borderGlow: "shadow-[0_0_35px_rgba(244,63,94,0.18)] border-rose-500/35",
    activeTab: "bg-rose-500/10 border-rose-400/35 text-rose-300",
    accentBg: "bg-rose-500/10",
    accentText: "text-rose-400",
    intro: "Good to connect. 💼\n\nI'm Sri, your executive risk advisor at Aegis.\n\nWhether it's cyber threats, professional liability, or protecting high-value assets — I help you stay a step ahead of risks that most people don't think about until it's too late.\n\nWhat's your primary concern today?",
    placeholder: "Tell Sri about your risk protection needs...",
    thinkingMessages: [
      "Analyzing your risk profile…",
      "Identifying the right protection strategy…",
      "Reviewing executive-level coverage options…",
    ],
  },
};

type AdvisorKey = keyof typeof ADVISORS;

interface Message {
  sender: "user" | "advisor";
  text: string;
  timestamp: string;
}

function AdvisorChat() {
  const searchParams = useSearchParams();
  const botParam = searchParams.get("bot");
  const categoryParam = searchParams.get("category");

  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const getInitialCategory = (): AdvisorKey => {
    const bot = botParam?.toLowerCase() || "";
    const cat = categoryParam?.toLowerCase() || "";
    if (bot === "alex" || cat === "motor" || cat === "car") return "motor";
    if (bot === "sarah" || cat === "health" || cat === "family") return "health";
    if (bot === "ethan" || cat === "travel") return "travel";
    if (bot === "emma" || cat === "property" || cat === "home") return "property";
    if (bot === "sri" || cat === "miscellaneous" || cat === "cyber" || cat === "executive") return "miscellaneous";
    return "miscellaneous"; // Defaults directly to Sri AI Executive Risk Advisor!
  };

  const [activeCategory, setActiveCategory] = useState<AdvisorKey>(getInitialCategory());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  // Real-time HUD system mock states
  const [pingSpeed, setPingSpeed] = useState("45ms");
  const [activeHandshakes, setActiveHandshakes] = useState(128);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const advisor = ADVISORS[activeCategory];

  // Simulating live system variations for premium feel
  useEffect(() => {
    const interval = setInterval(() => {
      setPingSpeed(`${Math.floor(Math.random() * 15 + 38)}ms`);
      setActiveHandshakes(prev => Math.max(120, Math.min(145, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Load history or show intro on category switch
  useEffect(() => {
    const load = async () => {
      try {
        const history = await chatService.getHistory();
        if (history && history.length > 0) {
          setMessages(history.map((m: any) => ({
            sender: m.sender === "customer" ? "user" : "advisor",
            text: m.message,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          })));
        } else {
          setMessages([{ sender: "advisor", text: advisor.intro, timestamp: now() }]);
        }
      } catch {
        setMessages([{ sender: "advisor", text: advisor.intro, timestamp: now() }]);
      }
    };
    load();
  }, [activeCategory]);

  // Handle URL parameters to trigger selectPlan / lead modal immediately
  useEffect(() => {
    const selectPlanParam = searchParams.get("selectPlan");
    if (selectPlanParam) {
      setSelectedPlan(decodeURIComponent(selectPlanParam));
    }
  }, [searchParams]);

  // Click-Safe autoscroll triggers (smoothsnap scheduler)
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Core send logic (memoized)
  const sendToAdvisor = useCallback(async (userMsg: string) => {
    setMessages(prev => [...prev, { sender: "user", text: userMsg, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setIsTyping(true);

    const msgs = ADVISORS[activeCategory].thinkingMessages;
    let idx = 0;
    setThinkingText(msgs[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setThinkingText(msgs[idx]);
    }, 2000);

    try {
      const res = await chatService.sendMessage(userMsg, activeCategory);
      const reply = res?.advisorMessage?.message || "I'm having trouble connecting right now. Please try again in a moment.";
      setMessages(prev => [...prev, { sender: "advisor", text: reply, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } catch {
      setMessages(prev => [...prev, {
        sender: "advisor",
        text: "I'm having a little trouble connecting right now. Please try again in a moment — I'm still here! 😊",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      clearInterval(interval);
      setIsTyping(false);
    }
  }, [activeCategory]);

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    const userMsg = inputVal.trim();
    setInputVal("");
    await sendToAdvisor(userMsg);
  }, [inputVal, sendToAdvisor]);

  // Memoized handlers to pass down to child AIChatMessages cleanly
  const handleOptionSelect = useCallback(async (optionText: string) => {
    await sendToAdvisor(optionText);
  }, [sendToAdvisor]);

  const handleApplyPlan = useCallback((planName: string) => {
    setSelectedPlan(planName);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    setVoiceActive(v => !v);
    if (!voiceActive) {
      setTimeout(() => {
        setInputVal("I'd like help choosing the best plan for my family.");
        setVoiceActive(false);
        inputRef.current?.focus();
      }, 2500);
    }
  };

  const sidebarAdvisors = [
    { id: "miscellaneous" as AdvisorKey, icon: <Shield className="w-4 h-4" />, label: "Sri AI", sub: "Executive Risk" },
    { id: "motor" as AdvisorKey, icon: <Car className="w-4 h-4" />, label: "Alex AI", sub: "Vehicle Asset" },
    { id: "health" as AdvisorKey, icon: <Heart className="w-4 h-4" />, label: "Sarah AI", sub: "Health floater" },
    { id: "travel" as AdvisorKey, icon: <Plane className="w-4 h-4" />, label: "Ethan AI", sub: "Global Passage" },
    { id: "property" as AdvisorKey, icon: <HomeIcon className="w-4 h-4" />, label: "Emma AI", sub: "Real Estate" },
  ];

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-slate-950 flex flex-col z-50 select-none touch-none">
      
      {/* Dynamic Global Scrollbar styling injected inline */}
      <style jsx global>{`
        .chat-messages-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .chat-messages-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-messages-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .chat-messages-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Cyber Grid Background details (pointer-events-none ensures clicks bypass them completely) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none opacity-50 z-0" />
      
      {/* Theme-aware glowing ambient particles (pointer-events-none z-0) */}
      <div 
        style={{ 
          background: `radial-gradient(circle, ${advisor.glowColor} 0%, rgba(0,0,0,0) 70%)`,
          transform: "translate3d(0, 0, 0)"
        }} 
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0 transition-all duration-700" 
      />
      <div className="absolute bottom-[10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none z-0" />

      {/* ─── TOP BAR: MINIMAL DEDICATED OS HEADER ─── */}
      <header className="h-16 border-b border-white/5 bg-slate-900/40 backdrop-blur-2xl px-6 flex items-center justify-between z-40 relative pointer-events-auto">
        <div className="flex items-center gap-4">
          <Link
            href="/consumer-dashboard"
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 active:shadow-[0_0_10px_rgba(255,255,255,0.1)] touch-manipulation select-none transition-all flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider pl-1 pr-1.5 hidden sm:inline">Portal</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className={`w-8.5 h-8.5 rounded-xl bg-gradient-to-tr ${advisor.theme} text-white font-black text-xs flex items-center justify-center`}>
              {advisor.avatar}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 leading-none">
                <h2 className="text-xs sm:text-sm font-black text-white">{advisor.name}</h2>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[9.5px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                {isTyping ? `${advisor.name} is streaming...` : "System Connected & Clear"}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Center OS Telemetry HUD details */}
        <div className="hidden md:flex items-center gap-4 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>NODE: {pingSpeed}</span>
          </div>
          <span className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>TELEMETRY SECURE</span>
          </div>
        </div>

        <div>
          <Link
            href="/"
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/20 active:scale-95 touch-manipulation select-none transition-all flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ─── MIDDLE: SPLIT WORKSPACE TERMINAL (Only chat area internally scrolls) ─── */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex gap-6 overflow-hidden z-30 relative pointer-events-auto">
        
        {/* Left Side Tab Options HUD Panel */}
        <div className="w-[260px] flex flex-col gap-4 flex-shrink-0 h-full overflow-hidden hidden lg:flex select-none">
          <div className="p-4 rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_rgba(0,0,0,0.3)] flex flex-col h-full overflow-hidden">
            
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-500">
                ACTIVE CHANNELS
              </p>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                STABLE
              </span>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-grow" style={{ scrollbarWidth: "none" }}>
              {sidebarAdvisors.map((a) => {
                const isActive = activeCategory === a.id;
                const adv = ADVISORS[a.id];
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveCategory(a.id)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer group active:scale-95 active:shadow-[0_0_10px_rgba(255,255,255,0.05)] touch-manipulation select-none relative overflow-hidden ${
                      isActive
                        ? adv.activeTab + " shadow-[0_0_20px_rgba(244,63,94,0.06)]"
                        : "bg-transparent border-transparent hover:bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white text-xs font-black flex items-center justify-center flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                      {a.icon}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="text-[12px] font-black leading-none">{a.label}</p>
                      <p className="text-[9px] font-medium mt-1 leading-none text-slate-500">{a.sub}</p>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 relative">
                        <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75 scale-150" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom hud system statistics */}
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3.5">
              <div className="space-y-1.5">
                <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">ACTIVE SOCKET HANDSHAKES</span>
                <p className="font-mono text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>{activeHandshakes} NODES LINKED</span>
                </p>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] leading-relaxed text-slate-500">
                All intake data compiled directly in secure sandbox vaults compliant with executive mandates.
              </div>
            </div>

          </div>
        </div>

        {/* Center/Right Messages Dashboard Canvas */}
        <div className={`flex-1 flex flex-col rounded-[32px] border overflow-hidden h-full transition-all duration-500 bg-slate-900/40 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/8 ${advisor.borderGlow} pointer-events-auto`}>
          
          {/* Scrollable Message stream panel (Internal scroll ONLY) */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 chat-messages-scroll relative touch-pan-y" style={{ scrollbarWidth: "thin" }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.01),transparent_50%)] pointer-events-none" />

            <div className="space-y-6">
              {messages.map((m, i) => (
                <div key={i}>
                  {m.sender === "advisor" ? (
                    <AIChatMessage
                      text={m.text}
                      advisorName={advisor.name}
                      advisorAvatar={advisor.avatar}
                      advisorTheme={advisor.theme}
                      timestamp={m.timestamp}
                      theme={theme as "dark" | "light"}
                      onApplyPlan={handleApplyPlan}
                      onOptionClick={handleOptionSelect}
                    />
                  ) : (
                    // User Message (highly optimized, GPU transforms ONLY)
                    <div className="flex justify-end w-full">
                      <div className="max-w-[75%] space-y-1.5 text-right">
                        <div className="px-5 py-3.5 rounded-3xl rounded-br-lg text-xs sm:text-[13px] font-semibold leading-relaxed text-left shadow-md bg-royal-600/20 border border-royal-500/20 text-slate-200">
                          {m.text}
                        </div>
                        <p className="text-[9.5px] px-1 text-slate-600">{m.timestamp}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming state thinking block */}
              {isTyping && (
                <div className="flex items-start gap-3 text-left">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisor.theme} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-md`}>
                    {advisor.avatar}
                  </div>
                  <div className="px-5 py-4 rounded-3xl rounded-tl-lg border border-white/5 bg-slate-950/60 shadow-inner space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-[10px] font-bold tracking-wider uppercase animate-pulse text-slate-500">
                      {thinkingText}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div ref={chatEndRef} />
          </div>

          {/* Voice transmission audio stream */}
          <AnimatePresence>
            {voiceActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-white/5 px-6 py-4 flex items-center gap-4 bg-slate-950/40"
              >
                <div className="flex items-center gap-1">
                  {[...Array(14)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [6, Math.random() * 26 + 6, 6] }}
                      transition={{ repeat: Infinity, duration: 0.4 + i * 0.03, ease: "easeInOut" }}
                      className="w-[3px] rounded-full bg-cyan-400"
                    />
                  ))}
                </div>
                <p className="text-xs font-bold uppercase tracking-wider animate-pulse text-slate-500">
                  🎤 Transmitting Voice Stream telemetry…
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Curved premium console floating input area */}
          <div className="p-4 border-t border-white/5 bg-slate-950/40 relative z-10 select-none">
            <form onSubmit={handleSend} className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleVoice}
                className={`p-3.5 rounded-2xl border flex-shrink-0 transition-all duration-200 cursor-pointer active:scale-95 active:shadow-[0_0_10px_rgba(244,63,94,0.3)] touch-manipulation select-none ${
                  voiceActive
                    ? "bg-rose-600 border-rose-500 text-white shadow-glow"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {voiceActive ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>

              <div className="flex-grow relative flex items-center select-text touch-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={advisor.placeholder}
                  className="w-full py-3.5 pl-5 pr-14 rounded-[22px] border outline-none text-xs font-semibold transition-all bg-slate-950/65 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:bg-slate-950 shadow-inner"
                />
                
                <span className="absolute right-4 text-[9px] font-mono font-bold text-slate-600 select-none uppercase tracking-widest hidden sm:inline">
                  ENTER
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="p-3.5 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:scale-100 active:scale-95 active:shadow-[0_0_12px_rgba(255,255,255,0.25)] touch-manipulation select-none bg-white text-slate-950 hover:bg-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                <Send className="w-4.5 h-4.5 stroke-[2.2]" />
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3.5 px-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
              <span>🔐 Pipeline V3.8</span>
              <span className="hidden sm:inline">Conversations are private & secure</span>
              <span>Cleared: IRDAI-MOCK</span>
            </div>
          </div>

        </div>

      </div>

      {/* Underwriting Lead Qualification Modal */}
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
        <div className="w-10 h-10 rounded-full border-4 border-royal-600 border-t-transparent animate-spin" />
      </div>
    }>
      <AdvisorChat />
    </Suspense>
  );
}
