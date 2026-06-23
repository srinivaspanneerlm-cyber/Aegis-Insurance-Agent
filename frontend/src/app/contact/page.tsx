"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, Heart, Car, Plane, Home as HomeIcon, 
  ArrowRight, Shield, Award, Star, Cpu, Users, Activity, 
  Check, PhoneCall, MessageSquare, Clock, Lock, Send, Mic, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

export default function ContactPage() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatConsoleRef = useRef<HTMLDivElement>(null);

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";
  
  // Computed theme style variables
  const glassCardClass = theme === "dark" 
    ? "bg-slate-900/40 border-white/5 shadow-2xl text-slate-300"
    : "bg-white border-slate-200/80 shadow-premium text-slate-700";

  const chatBgClass = theme === "dark"
    ? "bg-slate-900/60 border-white/5 shadow-2xl"
    : "bg-white border-slate-200 shadow-premium";

  const getAdvisorBubbleClass = () => {
    return theme === "dark" 
      ? "bg-slate-950 border-white/5 text-slate-200"
      : "bg-slate-100 border-slate-200 text-slate-700 shadow-sm";
  };

  const getUserBubbleClass = () => {
    return theme === "dark" 
      ? "bg-purple-600/20 border-purple-500/20 text-purple-200"
      : "bg-purple-50 border-purple-200/80 text-purple-700 shadow-sm font-medium";
  };

  const getInputClass = () => {
    return theme === "dark"
      ? "bg-slate-950 border-white/10 focus:border-purple-500 text-white"
      : "bg-slate-150 border-slate-250 focus:border-purple-650 text-navy-900 focus:bg-white shadow-inner";
  };

  // Pre-fill intro chat message
  useEffect(() => {
    setMessages([
      {
        sender: "advisor",
        text: `Hello 👋\nI’m Sri AI,\nChief Executive AI Advisor at Aegis AI.\n\nI’m here to help you with:\n• insurance guidance\n• technical support\n• platform assistance\n• consultation issues\n• AI recommendation clarification\n\nHow may I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // Sri AI Dynamic Executive Underwriting response generation
  const getExecutiveResponse = (query: string): string => {
    const norm = query.toLowerCase();
    if (norm.includes("hi") || norm.includes("hello") || norm.includes("greet") || norm.includes("hey")) {
      return "Greetings. I am Sri AI, Chief Executive AI Advisor. I orchestrate the high-fidelity risk valuation matrices here at Aegis AI. How can I facilitate your onboarding or calibrate your underwriter desk today?";
    }
    if (norm.includes("insurance") || norm.includes("guidance") || norm.includes("plan") || norm.includes("cover")) {
      return "Aegis AI operates on a conversational 'Talk-to-Unlock' private gate. To unlock coverages, navigate to the Policies Portal, select your specialized underwriter (Alex, Sarah, Ethan, or Emma), and complete the conversational intake parameters checklist. My models will then compile a custom holographic recommendation package for you.";
    }
    if (norm.includes("tech") || norm.includes("support") || norm.includes("error") || norm.includes("bug") || norm.includes("fail")) {
      return "Underwriting channels are fully active. All endpoints—including the Node.js API server and our Gemini fallback actuarial controllers—are healthy and responding under 45ms. If you experience a token mismatch, please clear your browser cache or re-authenticate in the Vault Room.";
    }
    if (norm.includes("recommend") || norm.includes("recommendation") || norm.includes("card") || norm.includes("hologram")) {
      return "Our recommendation engine parses customer-specified budget bounds and risk metrics in real-time, emitting structured JSON payloads formatted inside secure tags. This renders the premium holographic card in your console. Simply click 'Continue Secure Application' to lock in your pre-approved pricing.";
    }
    if (norm.includes("consult") || norm.includes("intake") || norm.includes("checklist")) {
      return "To resolve your intake metrics, ensure you provide: your name (or sign in), your household matrix size, comfort budget boundaries (e.g. ₹850/mo), coverage goals, and risk preferences. The live checklist indicator in your sidebar will tick green as these are cleared.";
    }
    if (norm.includes("account") || norm.includes("login") || norm.includes("register") || norm.includes("auth")) {
      return "Aegis AI enforces strict digital vault security. You can register an administrative account on our portal to access your unified Underwriter Dashboard, audit telemetry metrics, and manage pre-approved insurance application submissions.";
    }
    return "Query processed through executive leadership channels. Aegis AI is committed to establishing an intuitive, emotionally intelligent protection gateway. Let me know how I can further refine your consultation workflow, or direct you to a specialized underwriter command desk.";
  };

  const handleSendMessage = (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const finalMsg = customMsg || inputVal;
    if (!finalMsg.trim()) return;

    if (!customMsg) setInputVal("");
    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: finalMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    setIsTyping(true);

    setTimeout(() => {
      const aiReply = getExecutiveResponse(finalMsg);
      setMessages((prev) => [
        ...prev,
        {
          sender: "advisor",
          text: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleQuickAccess = (topic: string) => {
    setIsChatOpen(true);
    setTimeout(() => {
      chatConsoleRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    handleSendMessage(undefined, topic);
  };

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Cyber ambient backgrounds & grid meshes */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.15),rgba(255,255,255,0))]" />
          <div className="absolute top-[20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.04),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none" />
        </>
      )}

      {/* --- EXECUTIVE HERO SECTION --- */}
      <section className="relative pt-36 pb-12 flex-grow flex items-center justify-center z-10">
        <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* LEFT SIDE HERO TEXT */}
          <div className="lg:col-span-6 text-left space-y-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest leading-none">
                <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Executive Command Console</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wider leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Vault</span>
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
              Sri AI <br/>
              <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Chief Executive
              </span> <br/>
              AI Advisor
            </h1>
            
            <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
              Executive AI intelligence designed to provide intelligent support, consultation guidance, and AI-powered assistance across the Aegis AI ecosystem.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsChatOpen(true);
                  setTimeout(() => {
                    chatConsoleRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                    : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Talk With Sri AI</span>
              </button>
              
              <Link
                href="/policies"
                className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                  theme === "dark" ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Policies Gateway
              </Link>
            </div>
          </div>

          {/* RIGHT SIDE HOLOGRAPHIC EXECUTIVE VISUAL */}
          <div className="lg:col-span-6 flex justify-center items-center relative">
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
              
              {/* Rotating dashboard lines */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
                className={`absolute w-[90%] h-[90%] rounded-full border border-dashed opacity-10 ${
                  theme === "dark" ? "border-purple-400" : "border-indigo-400"
                }`}
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                className={`absolute w-[70%] h-[70%] rounded-full border border-double opacity-20 ${
                  theme === "dark" ? "border-cyan-400" : "border-purple-400"
                }`}
              />

              {/* Glowing Background Light Shaft */}
              <div className="absolute w-56 h-56 bg-gradient-to-tr from-purple-500/10 via-cyan-500/10 to-transparent blur-3xl rounded-full" />

              {/* Holographic Glowing AI Leadership Profile Card */}
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                className={`relative w-64 p-6 rounded-[32px] border-2 flex flex-col items-center justify-center transition-all ${
                  theme === "dark" 
                    ? "bg-slate-900/80 border-purple-500/40 text-purple-300 shadow-[0_0_40px_rgba(168,85,247,0.25)]"
                    : "bg-white border-purple-300 text-purple-700 shadow-[0_15px_30px_rgba(168,85,247,0.1)]"
                }`}
              >
                {/* Hologram Avatar Orb */}
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-purple-400 p-1 flex items-center justify-center relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-purple-500/10 animate-pulse" />
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-xl text-white shadow-lg relative z-10">
                    SAI
                  </div>
                  {/* Glowing core indicator */}
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-glow animate-pulse z-20" />
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-1">
                    <h3 className="text-base font-black text-white leading-none">Sri AI</h3>
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest block leading-none">
                    Chief Executive AI Advisor
                  </span>
                  
                  <div className="pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>🟢 ONLINE & ACTIVE</span>
                  </div>
                </div>
              </motion.div>

              {/* Floating ambient telemetry particles */}
              <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
          </div>

        </div>
      </section>

      {/* --- QUICK ACCESS SUPPORT CATEGORIES --- */}
      <section className="relative px-6 py-12 z-10">
        <div className="max-w-5xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intelligent Service Access</span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-none">Support Command Categories</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-left">
            {[
              { title: "Insurance Guidance", val: "🛡 Insurance Guidance", icon: <Shield className="w-5 h-5 text-cyan-400" /> },
              { title: "Technical Support", val: "⚙ Technical Support", icon: <Cpu className="w-5 h-5 text-purple-400" /> },
              { title: "AI Recommendation Help", val: "🤖 AI Recommendation Help", icon: <Sparkles className="w-5 h-5 text-emerald-400" /> },
              { title: "Consultation Assistance", val: "📋 Consultation Assistance", icon: <Activity className="w-5 h-5 text-rose-400" /> },
              { title: "Account Support", val: "🔐 Account Support", icon: <Lock className="w-5 h-5 text-amber-400" /> },
              { title: "Platform Questions", val: "💡 Platform Questions", icon: <PhoneCall className="w-5 h-5 text-pink-400" /> }
            ].map((card, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickAccess(card.val)}
                className={`p-5 rounded-[26px] border flex flex-col justify-between gap-4 text-left transition-all hover:scale-[1.02] cursor-pointer group ${glassCardClass}`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-wider leading-snug">{card.title}</h4>
                  <span className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider block mt-1.5">Launch chat →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --- AI CONVERSATION Vault Room (Anchor: chat) --- */}
      <section ref={chatConsoleRef} className="relative px-6 py-12 z-10">
        <div className="max-w-4xl mx-auto">
          
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`py-2 px-5 rounded-full border text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                isChatOpen
                  ? "bg-purple-650 border-purple-500 text-white shadow-glow"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              }`}
            >
              {isChatOpen ? "Close Secure Room" : "Open Secure Room"}
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Direct Link to Core Intel</span>
            </div>
          </div>

          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.3 }}
                className={`rounded-[32px] border overflow-hidden flex flex-col ${chatBgClass}`}
              >
                {/* Console header */}
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white shadow-lg text-sm">
                      S
                    </div>
                    <div className="text-left leading-none">
                      <h3 className="text-sm font-black text-white">Sri AI</h3>
                      <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest block mt-1">
                        Chief Executive AI Advisor
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-glow" />
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Telemetry Secure</span>
                  </div>
                </div>

                {/* Messages streams scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 max-h-[380px] min-h-[300px] text-left">
                  {messages.map((m, idx) => {
                    const isUser = m.sender === "user";
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-xs flex-shrink-0 mt-0.5">
                            S
                          </div>
                        )}
                        <div className="max-w-[80%] space-y-1">
                          <div className={`p-4 rounded-[22px] border text-xs font-semibold leading-relaxed whitespace-pre-line shadow-sm ${
                            isUser ? getUserBubbleClass() : getAdvisorBubbleClass()
                          }`}>
                            {m.text}
                          </div>
                          <span className="text-[9px] text-slate-500 block px-2 leading-none">
                            {m.timestamp}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Typing thinking state */}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-xs flex-shrink-0 mt-0.5">
                        S
                      </div>
                      <div className="space-y-1">
                        <div className={`p-4 rounded-[22px] border text-xs font-bold leading-normal italic flex items-center gap-3 ${getAdvisorBubbleClass()}`}>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-0" />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150" />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-300" />
                          </div>
                          <span className="text-slate-500 font-bold uppercase tracking-widest text-[9.5px] animate-pulse">
                            Orchestrating executive leadership channels...
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Footer chat console input */}
                <div className="p-4 border-t border-white/5 bg-slate-900/10">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder="Ask Sri AI about vault clearance, platform workflows..."
                      className={`flex-grow py-3 px-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                    />
                    <button
                      type="submit"
                      className="py-3 px-6 rounded-xl bg-purple-650 hover:bg-purple-600 text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 transition-all border border-purple-500/20 cursor-pointer"
                    >
                      <span>Transmit</span>
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </section>

      {/* --- TRUST & LEADERSHIP PILLARS --- */}
      <section className="relative px-6 py-12 z-10">
        <div className="max-w-5xl mx-auto space-y-10 text-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Executive Trust Seals</span>
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-none">AI Communication Protocols</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {[
              { title: "Executive AI Assistance", desc: "Speak directly with the primary operations brain monitoring network metrics.", icon: <Users className="w-5 h-5 text-cyan-400" /> },
              { title: "24/7 Intelligent Support", desc: "Fallback controllers respond continuously under 45ms even in offline periods.", icon: <Clock className="w-5 h-5 text-purple-400" /> },
              { title: "AI-Powered Guidance", desc: "No complex ticketing codes. Conversational matching handles queries naturally.", icon: <Cpu className="w-5 h-5 text-emerald-400" /> },
              { title: "Secure Consultation", desc: "Communications are compiled directly in authenticated vault directories.", icon: <Shield className="w-5 h-5 text-rose-400" /> }
            ].map((trust, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -6 }}
                className={`p-6 rounded-[28px] border flex flex-col justify-between transition-all relative overflow-hidden group ${glassCardClass}`}
              >
                <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />
                <div className="space-y-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {trust.icon}
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider leading-snug">{trust.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-normal font-semibold">{trust.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
