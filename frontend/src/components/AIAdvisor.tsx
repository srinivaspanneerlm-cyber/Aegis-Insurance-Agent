"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Shield, Heart, Car, Globe, Send, User, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { chatService } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  recommendation?: {
    title: string;
    coverage: string;
    premium: string;
    claimRatio: string;
    benefits: string[];
    icon: string;
  };
}

interface AIAdvisorProps {
  onSelectPlan: (plan: string) => void;
  onScrollToForm: () => void;
}

export default function AIAdvisor({ onSelectPlan, onScrollToForm }: AIAdvisorProps) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "Hello! I am Aegis, your Personal Financial Protection Advisor. Together, we can build a bulletproof safety net for your family in under 2 minutes. Which area of protection shall we secure today?",
      timestamp: "Just Now",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  // Write-only: set when history fails to load, but nothing renders off it yet.
  const [, setIsPreviewMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1) Load Chat History from backend if logged in
  useEffect(() => {
    async function loadChatHistory() {
      // Auth is a cookie now; just try to load history. If we're not logged in
      // the request returns 401 and we fall back to preview mode below.
      try {
        const history = await chatService.getHistory();
        if (history && history.length > 0) {
          const mappedMessages = history.map((chat: any) => {
            const isUser = chat.sender === "customer";
            const text = chat.message;
            return {
              id: chat.id,
              sender: isUser ? "user" : "ai",
              text,
              timestamp: new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              recommendation: isUser ? undefined : getRecommendationForText(text),
            };
          });
          setMessages(mappedMessages);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setIsPreviewMode(true);
      }
    }

    loadChatHistory();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping, typingText]);

  const quickActions = [
    { label: "Family Health Insurance", icon: Heart, color: "text-rose-500 bg-rose-50 border-rose-100" },
    { label: "AI Term Life Shield", icon: Shield, color: "text-royal-600 bg-blue-50 border-blue-100" },
    { label: "Smart Vehicle Guard", icon: Car, color: "text-amber-500 bg-amber-50 border-amber-100" },
    { label: "Travel Secure Plus", icon: Globe, color: "text-cyan-500 bg-cyan-50 border-cyan-100" },
  ];

  const getRecommendationForText = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("health") || lower.includes("comprehensive health") || lower.includes("family") || lower.includes("hospital") || lower.includes("spouse") || lower.includes("kids")) {
      return {
        title: "Aegis Supreme Health Shield",
        coverage: "₹1 Crore Cover",
        premium: "₹850 / mo",
        claimRatio: "99.2% Claims Settled",
        benefits: ["Zero Co-Pay Required", "Day-1 Pre-Existing Cover", "Unlimited Road Ambulance"],
        icon: "heart",
      };
    }
    if (lower.includes("life") || lower.includes("legacy") || lower.includes("term") || lower.includes("retirement")) {
      return {
        title: "Aegis Elite Life Shield",
        coverage: "₹1.5 Crore Cover",
        premium: "₹1,120 / mo",
        claimRatio: "99.7% Claims Settled",
        benefits: ["Immediate Distress Payout", "Terminal Illness Rider", "Accidental Death Benefit"],
        icon: "shield",
      };
    }
    if (lower.includes("car") || lower.includes("vehicle") || lower.includes("bike") || lower.includes("garage") || lower.includes("depreciation")) {
      return {
        title: "Aegis Smart Auto Shield",
        coverage: "₹8.5 Lakh IDV",
        premium: "₹450 / mo",
        claimRatio: "98.4% Claims Settled",
        benefits: ["Zero Depreciation Lock", "Free Roadside Recovery", "Consumables Covered"],
        icon: "car",
      };
    }
    if (lower.includes("travel") || lower.includes("trip") || lower.includes("flight") || lower.includes("global emergency")) {
      return {
        title: "Aegis Travel Secure Shield",
        coverage: "₹50 Lakh Cover",
        premium: "₹280 / mo",
        claimRatio: "99.0% Claims Settled",
        benefits: ["Global Emergency Rescue", "Lost baggage coverage", "Flight Delay Reimbursement"],
        icon: "globe",
      };
    }
    return undefined;
  };

  const handleQuickAction = (actionLabel: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: `Tell me about ${actionLabel}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    triggerAIResponse(`Tell me about ${actionLabel}`);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputVal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    const query = inputVal;
    setInputVal("");
    triggerAIResponse(query);
  };

  const getDynamicTypingText = (query: string): string => {
    const norm = query.toLowerCase();
    if (norm.includes("family") || norm.includes("child") || norm.includes("kid") || norm.includes("spouse") || norm.includes("health")) {
      return "Assessing optimal family health protection configurations...";
    }
    if (norm.includes("budget") || norm.includes("cost") || norm.includes("cheap") || norm.includes("affordable") || norm.includes("premium")) {
      return "Comparing coverage-to-premium protection ratios...";
    }
    if (norm.includes("life") || norm.includes("term") || norm.includes("legacy") || norm.includes("retirement")) {
      return "Calculating long-term secure legacy projections...";
    }
    if (norm.includes("vehicle") || norm.includes("car") || norm.includes("auto") || norm.includes("bike")) {
      return "Analyzing vehicle asset safety and auto-underwriting metrics...";
    }
    if (norm.includes("travel") || norm.includes("trip") || norm.includes("global") || norm.includes("international")) {
      return "Configuring international emergency medical rescue routes...";
    }
    return "Analyzing your personal protection needs...";
  };

  const triggerAIResponse = async (query: string) => {
    setIsTyping(true);
    
    // Select dynamic, topic-aware starting phrase
    const initialText = getDynamicTypingText(query);
    setTypingText(initialText);

    // Dynamic, premium sub-state cycling phrases
    const cyclingPhrases = [
      "Consulting Aegis sovereign underwriting models...",
      "Securing premium pre-approved rate locks...",
      "Verifying cashless network coverage access...",
      "Structuring your bespoke protection portfolio..."
    ];
    let cycleIndex = 0;

    const intervalId = setInterval(() => {
      if (cycleIndex < cyclingPhrases.length) {
        setTypingText(cyclingPhrases[cycleIndex]);
        cycleIndex++;
      }
    }, 1200);

    if (!isAuthenticated) {
      // 1) Enforce Authentication Rules for unauthenticated users
      setTimeout(() => {
        clearInterval(intervalId);
        const text = "To continue your personalized AI insurance consultation, please login or create an account first.\n\nThis helps us provide:\n• personalized insurance recommendations\n• secure policy management\n• saved conversation history\n• better financial guidance\n\nPlease sign in to continue.";

        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "ai",
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 2000);
    } else {
      // 2) Real Connected Backend Connection
      try {
        const data = await chatService.sendMessage(query);
        clearInterval(intervalId);
        setIsTyping(false);
        if (data && data.advisorMessage) {
          const text = data.advisorMessage.message;
          setMessages((prev) => [
            ...prev,
            {
              id: data.advisorMessage.id,
              sender: "ai",
              text,
              timestamp: new Date(data.advisorMessage.createdAt ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              recommendation: getRecommendationForText(text),
            },
          ]);
        }
      } catch (err: any) {
        console.error("AI service error:", err);
        clearInterval(intervalId);
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "ai",
            text: "My apologies. Our secure underwriting models are experiencing a brief synchronization error. Please log back into your protection vault.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    }
  };


  return (
    <section id="ai-advisor" className="py-24 bg-slate-50 relative overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 rounded-full bg-cyan-400/5 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-royal-600/5 blur-3xl" />

      <div className="max-w-4xl mx-auto px-6">
        {/* Title Block */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-royal-50 border border-royal-100 rounded-full py-1 px-3.5 text-royal-600 font-semibold text-xs tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Decisions Engineered by AI</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-navy-900 tracking-tight">
            Consult Your Personal AI Protection Advisor
          </h2>
          <p className="text-slate-500 text-sm md:text-base max-w-lg mx-auto">
            Dynamic, objective, premium advice. Secure your family shield in real-time.
          </p>
        </div>

        {/* Advisor Interface Container */}
        <div className="relative rounded-3xl bg-white border border-slate-200/80 shadow-premium overflow-hidden">
          {/* Glowing Top Frame */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-royal-600 via-royal-500 to-cyan-500" />

          {/* Advisor Header Bar */}
          <div className="bg-navy-950 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-royal-600 to-cyan-500 flex items-center justify-center text-white border border-white/20 shadow-glow-blue">
                  <Shield className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-emerald-500 rounded-full border-2 border-navy-950 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-[15px] flex items-center gap-1.5 tracking-tight">
                  <span>Aegis AI Advisor</span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full py-0.5 px-2 font-bold uppercase tracking-wider">
                    Online
                  </span>
                </h4>
                <p className="text-[11.5px] text-slate-400">Personal Financial Protection Suite</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Secure Encrypted Connection</span>
            </div>
          </div>

          {/* Chat Window Box */}
          <div className="h-[460px] overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-start gap-3.5 ${
                    msg.sender === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
                    msg.sender === "ai"
                      ? "bg-navy-900 shadow-sm"
                      : "bg-royal-600 shadow-sm"
                  }`}>
                    {msg.sender === "ai" ? (
                      <Shield className="w-4.5 h-4.5 text-cyan-400" />
                    ) : (
                      <User className="w-4.5 h-4.5 text-white" />
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div className="max-w-[78%] flex flex-col gap-3">
                    <div className={`p-4 rounded-2xl shadow-sm text-[14.5px] leading-relaxed ${
                      msg.sender === "ai"
                        ? "bg-white text-navy-900 border border-slate-100"
                        : "bg-navy-900 text-white"
                    }`}>
                      {msg.text}
                    </div>

                    {/* Recommendation Card Embedded overlay */}
                    {msg.recommendation && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-premium mt-1.5 relative overflow-hidden"
                      >
                        {/* Highlighting badge */}
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-royal-600 to-cyan-500 text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                          Best Match
                        </div>

                        {/* Title & Icon Header */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 text-royal-600 flex items-center justify-center border border-slate-100 flex-shrink-0">
                            {msg.recommendation.icon === "heart" && <Heart className="w-5.5 h-5.5 text-rose-500 fill-rose-50" />}
                            {msg.recommendation.icon === "shield" && <Shield className="w-5.5 h-5.5 text-royal-600" />}
                            {msg.recommendation.icon === "car" && <Car className="w-5.5 h-5.5 text-amber-500" />}
                            {msg.recommendation.icon === "globe" && <Globe className="w-5.5 h-5.5 text-cyan-500" />}
                          </div>
                          <div>
                            <h5 className="font-bold text-navy-900 text-[14.5px]">
                              {msg.recommendation.title}
                            </h5>
                            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                              {msg.recommendation.claimRatio}
                            </span>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-4 py-4 my-3 border-y border-slate-100 text-left">
                          <div>
                            <span className="text-[11px] text-slate-400 font-medium">Policy Coverage</span>
                            <p className="font-bold text-navy-900 text-base">{msg.recommendation.coverage}</p>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 font-medium">Monthly Cost</span>
                            <p className="font-bold text-royal-600 text-base">{msg.recommendation.premium}</p>
                          </div>
                        </div>

                        {/* Key Benefits List */}
                        <div className="space-y-2 mb-4">
                          {msg.recommendation.benefits.map((benefit, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-2 text-slate-600 text-xs">
                              <Check className="w-4 h-4 text-emerald-500 stroke-[3.5] flex-shrink-0" />
                              <span className="font-medium">{benefit}</span>
                            </div>
                          ))}
                        </div>

                        {/* Select Plan Button */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onSelectPlan(msg.recommendation!.title);
                              onScrollToForm();
                            }}
                            className="w-full bg-gradient-to-r from-royal-600 to-royal-700 hover:from-royal-700 hover:to-royal-800 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-sm transition-colors text-center"
                          >
                            Lock In This Plan
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* AI Typing Thinking State */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-8 h-8 rounded-xl bg-navy-900 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Shield className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-100 text-navy-900 shadow-sm flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-slate-500">{typingText}</span>
                  <span className="typing-cursor" />
                </div>
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Action Suggestion Row */}
          <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-wrap gap-2.5 items-center justify-start">
            <span className="text-[11.5px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
              Quick Suggestions:
            </span>
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.label)}
                className={`flex items-center gap-1.5 py-1.5 px-3.5 border rounded-full text-xs font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 cursor-pointer ${action.color}`}
              >
                <action.icon className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Input Console */}
          <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask me anything: 'Is dental covered?' or 'What plan is best for child security?'"
              className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white rounded-2xl text-[14px] text-navy-900 placeholder-slate-400 outline-none border border-slate-150 focus:border-royal-500 focus:ring-1 focus:ring-royal-500/20 transition-all"
            />
            <button
              type="submit"
              className="w-12 h-12 rounded-2xl bg-navy-900 hover:bg-navy-950 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-4.5 h-4.5 stroke-[2]" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
