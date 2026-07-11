"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, Heart, Car, Globe, MessageSquare, 
  FileText, CheckCircle2, AlertCircle, ArrowUpRight, 
  Download, Upload, Bell, User, Settings, LogOut, 
  Activity, Sparkles, ChevronRight, Check, Play, Clock, 
  ShieldCheck, ArrowRight, Menu, X, HelpCircle, PhoneCall,
  UserCheck, ShieldAlert, Zap, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { chatService, policyService } from "@/services/api";

export default function ConsumerDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // Navigation states
  const [activeNav, setActiveNav] = useState<"dashboard" | "policies" | "advisor" | "claims" | "documents" | "notifications">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dynamic state integrations
  const [dbPolicies, setDbPolicies] = useState<any[]>([]);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(true);

  // Chat Advisor States
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: "1",
      sender: "ai",
      text: "Welcome back! I've audited your active coverage portfolios. Your Family Protection Index stands at an excellent 82%, but adding a Smart Auto Shield would lock in complete 360-degree security. What shall we explore today?",
      timestamp: "Just Now",
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Notification lists
  const [notifications, setNotifications] = useState([
    { id: 1, title: "AI Audit Cleared", message: "Family health protection coverage has passed the quarterly regulatory evaluation.", time: "2 hours ago", type: "audit", read: false },
    { id: 2, title: "Premium Lock Safe", message: "Your Aegis Supreme Health Shield premium rate is locked in until 2027.", time: "1 day ago", type: "premium", read: true },
    { id: 3, title: "KYC Clearance Verified", message: "Your sovereign ID credentials have been successfully updated in our decentralized cloud vault.", time: "3 days ago", type: "kyc", read: true },
  ]);

  // Upload/Document center mock state
  const [uploadedFiles, setUploadedFiles] = useState([
    { id: "doc-1", name: "Supreme_Health_Shield_Certificate.pdf", size: "2.4 MB", type: "policy", date: "May 10, 2026" },
    { id: "doc-2", name: "Sovereign_Aadhaar_KYC_Encrypted.pdf", size: "1.1 MB", type: "kyc", date: "May 14, 2026" },
    { id: "doc-3", name: "Premium_Receipt_Q1_2026.pdf", size: "850 KB", type: "receipt", date: "April 02, 2026" },
  ]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Load Policies
  useEffect(() => {
    async function fetchUserPolicies() {
      try {
        const data = await policyService.getPolicies();
        if (data && data.length > 0) {
          setDbPolicies(data);
        }
      } catch (err) {
        console.warn("Failed to load user policies. Proceeding with premium defaults.");
      } finally {
        setIsPoliciesLoading(false);
      }
    }
    fetchUserPolicies();
  }, []);

  // Chat autoscroll
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const data = await chatService.sendMessage(userText);
      setIsTyping(false);
      if (data && data.advisorMessage) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: data.advisorMessage.id,
            sender: "ai",
            text: data.advisorMessage.message,
            timestamp: new Date(data.advisorMessage.createdAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ]);
      }
    } catch (err) {
      setTimeout(() => {
        setIsTyping(false);
        let fallback = "I've analyzed your protection profile. Your health shield is secured, but I suggest scheduling a short audit to review accidental recovery riders.";
        if (userText.toLowerCase().includes("auto") || userText.toLowerCase().includes("car")) {
          fallback = "For your vehicle protection, the Aegis Smart Auto Shield locks in zero-depreciation coverage, instant cashless garages, and 24/7 recovery for ₹450 / month.";
        } else if (userText.toLowerCase().includes("life") || userText.toLowerCase().includes("term")) {
          fallback = "Your family's dynamic future is best secured with our Elite Life Shield, offering a ₹1.5 Crore death cover with an immediate distress payout desk.";
        }
        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "ai",
            text: fallback,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ]);
      }, 1200);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingDoc(true);
      setUploadSuccess("");

      setTimeout(() => {
        setUploadingDoc(false);
        setUploadSuccess(`Securely encrypted: "${file.name}" added to KYC vault!`);
        setUploadedFiles((prev) => [
          {
            id: `doc-${Date.now()}`,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            type: "kyc",
            date: "Today",
          },
          ...prev,
        ]);
      }, 2000);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (loading || isPoliciesLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center flex-col gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-purple-550 border-t-transparent animate-spin" />
            <Shield className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Synchronizing Dynamic Dashboard...</h3>
        </div>
        <Footer />
      </div>
    );
  }

  const activePoliciesList = dbPolicies.length > 0 ? dbPolicies : [
    { policyName: "Aegis Supreme Health Shield", premium: 850, coverage: "₹1 Crore Cover", status: "active", claimRatio: "99.2%" },
  ];

  // Theme styling computed
  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

  // Framer Motion variant options
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 70,
        damping: 15,
      },
    },
  } as const;

  // Determine client archetype based on name or defaults
  const clientName = user?.name || "Premium Client";
  const clientArchetype = clientName.toLowerCase().includes("admin") || clientName.toLowerCase().includes("test")
    ? "Balanced Risk Manager"
    : "Family-Focused Planner";

  const getArchetypeExplanation = (arch: string) => {
    if (arch === "Balanced Risk Manager") {
      return "You maintain a highly optimized asset coverage ratio, balancing premium cost-efficiency with solid coverage networks across motor and health sectors.";
    }
    return "You prioritize absolute family protection, comprehensive financial security matrices, and high-touch cashless healthcare preparedness.";
  };

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Interactive ambient floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-3 h-3 rounded-full ${
              i % 2 === 0 ? "bg-purple-500/20" : "bg-cyan-500/20"
            } blur-sm`}
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i * 12) % 60}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, i % 2 === 0 ? 15 : -15, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Cinematic animated tech glows */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.18),rgba(255,255,255,0))]" />
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[130px] pointer-events-none" 
          />
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/8 blur-[120px] pointer-events-none" 
          />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.06),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-purple-100/40 blur-[100px] pointer-events-none" />
        </>
      )}

      {/* Main Layout Grid */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-36 pb-24 flex-grow flex flex-col md:flex-row gap-8 relative z-10">
        
        {/* SIDEBAR NAVIGATION PANEL (Redesigned & Premium) */}
        <aside className={`hidden md:flex md:w-64 flex-col rounded-[32px] border p-6 text-left space-y-7 self-start transition-all duration-300 ${
          theme === "dark" 
            ? "bg-slate-900/40 border-white/5 shadow-2xl backdrop-blur-xl" 
            : "bg-white/80 border-slate-200 shadow-premium backdrop-blur-xl"
        }`}>
          {/* User Profile Badge with Pulse Node Indicator */}
          <div className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
            theme === "dark" ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-150"
          }`}>
            {/* Holographic flow on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center font-black text-sm border border-purple-500/20 shadow-md">
                {clientName.charAt(0).toUpperCase()}
              </div>
              {/* Pulsing AI Activity Indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-glow">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </span>
            </div>
            
            <div className="overflow-hidden relative z-10 text-left">
              <p className={`text-xs font-black truncate leading-none ${theme === "dark" ? "text-white" : "text-navy-950"}`}>{clientName}</p>
              <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1.5 inline-flex items-center gap-1 leading-none">
                <Zap className="w-2.5 h-2.5 fill-cyan-400 animate-pulse" />
                <span>AI MATCHED</span>
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "dashboard", label: "Overview Console", icon: Activity },
              { id: "policies", label: "Protection Plans", icon: Heart },
              { id: "advisor", label: "AI Advisor Core", icon: Sparkles },
              { id: "claims", label: "Claims Safe-Track", icon: Shield },
              { id: "documents", label: "Secure Doc Vault", icon: FileText },
              { id: "notifications", label: "Security Bulletins", icon: Bell },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id as any)}
                  className={`w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all cursor-pointer group ${
                    isActive 
                      ? "bg-purple-650 text-white shadow-glow border border-purple-500/20" 
                      : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <IconComp className={`w-4.5 h-4.5 transition-colors ${
                    isActive ? "text-cyan-300" : "text-slate-450 group-hover:text-purple-400"
                  }`} />
                  <span className="mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-6 border-t border-white/5 space-y-1">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span>Lock & Log Out</span>
            </button>
          </div>
        </aside>

        {/* MOBILE NAVIGATION CONTAINER */}
        <div className="md:hidden flex items-center justify-between bg-slate-900 border border-white/5 rounded-2xl p-4 shadow-sm w-full">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8.5 h-8.5 rounded-lg bg-purple-550 text-white flex items-center justify-center font-black text-sm">
                {clientName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 shadow-glow" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white leading-none">{clientName}</p>
              <p className="text-[8px] text-cyan-400 font-extrabold uppercase tracking-widest mt-1 leading-none">Protection Active</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 cursor-pointer"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden w-full bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col gap-4 text-left z-20"
            >
              {[
                { id: "dashboard", label: "Overview Console", icon: Activity },
                { id: "policies", label: "Protection Plans", icon: Heart },
                { id: "advisor", label: "AI Advisor Core", icon: Sparkles },
                { id: "claims", label: "Claims Safe-Track", icon: Shield },
                { id: "documents", label: "Secure Doc Vault", icon: FileText },
                { id: "notifications", label: "Security Bulletins", icon: Bell },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id as any);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider ${
                    activeNav === item.id 
                      ? "bg-purple-650 text-white" 
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-500 hover:bg-rose-500/10"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Lock & Log Out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* VIEWPORT CONTROLLER PANEL */}
        <div className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            
            {/* VIEWPORT 1: REDESIGNED PREMIUM CONSUMER WORKSPACE */}
            {activeNav === "dashboard" && (
              <motion.div
                key="dashboard"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="space-y-8"
              >
                {/* 1. Personalized Hero Section with Futuristic Glow & Animation */}
                <motion.div 
                  variants={cardVariants}
                  className={`rounded-[32px] p-6 sm:p-10 border relative overflow-hidden text-left group shadow-2xl transition-all duration-300 ${
                    theme === "dark" 
                      ? "bg-gradient-to-r from-purple-950/40 via-slate-900/40 to-indigo-950/40 border-white/5 shadow-purple-950/10" 
                      : "bg-gradient-to-r from-purple-50 via-white to-cyan-50 border-slate-200/80 shadow-premium"
                  }`}
                >
                  {/* Holographic background element animations */}
                  <div className="absolute top-[-50%] right-[-10%] w-80 h-80 rounded-full bg-purple-550/10 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute bottom-[-50%] left-[-10%] w-80 h-80 rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                    <div className="space-y-4 max-w-xl">
                      {/* Greeting tags */}
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 py-1.5 px-4 rounded-full border border-cyan-800/30">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span>AI Co-Pilot Protection Online</span>
                      </span>
                      
                      <h2 className={`text-2.5xl sm:text-4.5xl font-black tracking-tight leading-none ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                        Welcome Back, {clientName} 👋
                      </h2>
                      
                      <p className={`text-xs sm:text-[13.5px] leading-relaxed font-semibold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>
                        Your personalized protection insights and AI recommendations are ready. Aegis risk models have validated your coverage limits across health & assets.
                      </p>
                    </div>

                    {/* Quick Telemetry Summary */}
                    <div className={`flex items-center gap-4 border rounded-2xl p-4.5 self-start lg:self-center shadow-lg backdrop-blur-md transition-all duration-300 ${
                      theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-white/80 border-slate-200"
                    }`}>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shadow-glow" />
                      <div className="text-left space-y-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Security Node</p>
                        <p className={`text-xs font-black mt-1 leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>ECDSA Sync Secured</p>
                        <p className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest">Vault Active</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Sub sections splits */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column (lg:col-span-2): Chat, Memory, and Recommendations */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* 2. Sarah AI Advisor & Recommendation Summary Block */}
                    <motion.div 
                      variants={cardVariants}
                      className={`rounded-[32px] border p-6 sm:p-8 space-y-6 text-left relative overflow-hidden flex flex-col justify-between min-h-[460px] ${
                        theme === "dark" ? "bg-slate-900/40 border-white/5 shadow-2xl" : "bg-white border-slate-200 shadow-premium"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0">
                        <div className="flex items-center gap-3.5">
                          {/* Pulsing Sarah Avatar */}
                          <div className="relative">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center shadow-md">
                              <Sparkles className="w-6 h-6 fill-white animate-pulse" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                          </div>
                          <div>
                            <h3 className={`text-sm font-black leading-none ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Sarah AI Advisor</h3>
                            {/* Glowing recommendation badge */}
                            <span className="inline-flex items-center gap-1 text-[8.5px] text-purple-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                              <span>AI Optimized Underwriting</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-white/5 border border-white/10 py-1.5 px-3 rounded-full font-bold">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span>Audit Active</span>
                        </div>
                      </div>

                      {/* AI Advisor Speech Block (Memory and Recommendations) */}
                      <div className={`p-4.5 rounded-2xl border text-[12px] leading-relaxed font-semibold text-left ${
                        theme === "dark" ? "bg-purple-950/15 border-purple-500/20 text-slate-300" : "bg-purple-50/50 border-purple-100 text-slate-700"
                      }`}>
                        <p className="flex items-start gap-2">
                          <span className="text-purple-400 text-sm mt-0.5">✦</span>
                          <span>
                            <strong>Sarah AI prepared:</strong> Based on your profile and family priorities, I have audited your active coverages. Your Supreme Health Shield is fully locked, but we detected a key coverage gap in your vehicle assets.
                          </span>
                        </p>
                      </div>

                      {/* Chat messages */}
                      <div className="flex-grow my-2 overflow-y-auto space-y-4 max-h-[200px] pr-2 text-left">
                        {chatMessages.map((msg) => {
                          const isAI = msg.sender === "ai";
                          return (
                            <div
                              key={msg.id}
                              className={`flex gap-3 max-w-[85%] ${isAI ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"}`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                                isAI ? "bg-purple-650/20 text-purple-300 border border-purple-500/20" : "bg-purple-650 text-white"
                              }`}>
                                {isAI ? "S" : "U"}
                              </div>
                              <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-semibold ${
                                isAI 
                                  ? (theme === "dark" ? "bg-white/[0.02] border border-white/5 text-slate-300" : "bg-slate-50 border border-slate-150 text-slate-700") 
                                  : "bg-purple-650 text-white shadow-sm"
                              }`}>
                                {msg.text}
                              </div>
                            </div>
                          );
                        })}

                        {isTyping && (
                          <div className="flex gap-3 max-w-[80%] mr-auto">
                            <div className="w-8 h-8 rounded-lg bg-purple-650/20 text-purple-300 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
                              S
                            </div>
                            <div className={`p-4 rounded-2xl flex items-center gap-1.5 shadow-sm border ${
                              theme === "dark" ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-150"
                            }`}>
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat input controls */}
                      <form onSubmit={handleSendMessage} className={`flex gap-2 border rounded-2xl p-2.5 flex-shrink-0 transition-colors duration-300 ${
                        theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-100 border-slate-200"
                      }`}>
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask Sarah about coverage limits, vehicle riders, or claims matching..."
                          className={`flex-1 bg-transparent px-3 outline-none text-[12px] font-semibold ${
                            theme === "dark" ? "text-white placeholder-slate-500" : "text-navy-950 placeholder-slate-400"
                          }`}
                        />
                        <button
                          type="submit"
                          className="bg-purple-650 hover:bg-purple-600 text-white py-2 px-4.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 shadow-glow"
                        >
                          <span>Ask</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </form>
                    </motion.div>

                    {/* 3. Continue Conversation Section with Advisor details & History memory */}
                    <motion.div 
                      variants={cardVariants}
                      className={`rounded-[24px] border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                        theme === "dark" ? "bg-slate-900/30 border-white/5 hover:border-purple-550/20" : "bg-white border-slate-200 shadow-premium"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 text-left">
                        <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 flex items-center justify-center border border-purple-800/30 flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className={`text-xs font-black ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Continue Your AI Consultation</p>
                          <p className="text-[11.5px] text-slate-500 font-semibold mt-0.5">Resume your family health protection session with Sarah AI.</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setActiveNav("advisor")}
                        className="bg-purple-650 hover:bg-purple-600 text-white font-bold py-2.5 px-4.5 rounded-xl text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 self-start sm:self-center shadow-glow"
                      >
                        <span>Resume Dialogue</span>
                        <ArrowRight className="w-4 h-4 animate-pulse" />
                      </button>
                    </motion.div>

                    {/* 4. Personalized Recommendations System */}
                    <div className="space-y-4 text-left">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h3 className={`font-black text-sm tracking-widest uppercase ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Personalized Protection Goals</h3>
                        <span className="text-[9.5px] bg-purple-950/40 text-purple-300 font-extrabold uppercase px-3 py-1 rounded-full border border-purple-800/40">
                          Matrix Coverage Suggestions
                        </span>
                      </div>

                      {/* Memory & Recommendations Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Recommendation Card 1: Active Health Shield */}
                        <div className={`rounded-3xl p-6 border flex flex-col justify-between group text-slate-350 shadow-2xl hover:border-purple-550/20 transition-all text-left ${
                          theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                        }`}>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 rounded-xl bg-rose-950/40 text-rose-450 border border-rose-800/30 flex items-center justify-center">
                                <Heart className="w-5.5 h-5.5 fill-rose-500 stroke-[2]" />
                              </div>
                              <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-bold py-1 px-3.5 rounded-full text-[9px] uppercase tracking-wider leading-none">
                                ACTIVE 🔒
                              </span>
                            </div>
                            <div>
                              <h4 className={`font-black text-sm group-hover:text-purple-400 transition-colors leading-tight truncate ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                                Aegis Supreme Health Shield
                              </h4>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">Claim Desk Sync: 100% Verified</p>
                              {/* Memory connection hook */}
                              <p className="text-[10.5px] text-slate-450 mt-2 font-semibold leading-relaxed">
                                Sarah AI locked premium rate limits secure until 2027.
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/5 mt-5 flex items-baseline justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Coverage</span>
                              <span className={`text-xs font-black mt-0.5 block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>₹1 Crore Cover</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Premium Rate</span>
                              <span className="text-xs font-black text-purple-400 mt-0.5 block">₹850/mo</span>
                            </div>
                          </div>
                        </div>

                        {/* Recommendation Card 2: Suggested Auto Shield */}
                        <div className={`rounded-3xl p-6 border flex flex-col justify-between group text-slate-350 shadow-2xl hover:border-cyan-550/20 transition-all text-left relative ${
                          theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                        }`}>
                          {/* Animated Border Beam glow */}
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-indigo-500 animate-pulse" />
                          
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 rounded-xl bg-cyan-950/40 text-cyan-400 border border-cyan-800/30 flex items-center justify-center">
                                <Car className="w-5.5 h-5.5 stroke-[2]" />
                              </div>
                              <span className="bg-purple-950/40 text-purple-300 border border-purple-800/30 font-black py-1.5 px-3.5 rounded-full text-[9px] uppercase tracking-wider leading-none flex items-center gap-1 shadow-glow animate-pulse">
                                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                                <span>AI RECOMMENDED</span>
                              </span>
                            </div>
                            <div>
                              <h4 className={`font-black text-sm group-hover:text-cyan-400 transition-colors leading-tight truncate ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                                Aegis Smart Auto Shield
                              </h4>
                              <p className="text-[10px] text-slate-550 font-bold mt-1">Recommended: Zero depreciation</p>
                              {/* Supportive non-salesy message */}
                              <p className="text-[10.5px] text-slate-450 mt-2 font-semibold leading-relaxed">
                                Protect your daily travel vectors. Locks in zero-depreciation coverage and 24/7 recovery.
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/5 mt-5 flex items-baseline justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Sizing Guide</span>
                              <span className={`text-xs font-black mt-0.5 block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>₹25 Lakh Cover</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Premium Est.</span>
                              <span className="text-xs font-black text-cyan-450 mt-0.5 block">₹450/mo</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interactive AI Memory status logs (human-like AI experience) */}
                      <div className={`p-4 rounded-2xl border text-[11px] font-bold flex items-center justify-between gap-3 text-left ${
                        theme === "dark" ? "bg-white/[0.01] border-white/5 text-slate-500" : "bg-slate-100/50 border-slate-200 text-slate-500"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-purple-500/60" />
                          <span>
                            Sarah AI memories synced: Last time you explored family protection plans on May 25, 2026.
                          </span>
                        </div>
                        <span className="text-[8.5px] text-cyan-400/80 font-mono tracking-wider">BLOCK #0x4A7B</span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column (lg:col-span-1): Score, Profile archetype, and Quick Actions */}
                  <div className="space-y-8 text-left">
                    
                    {/* 5. Holographic Protection Score Circle Widget */}
                    <motion.div 
                      variants={cardVariants}
                      className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ${
                        theme === "dark" ? "bg-slate-900/40 border-white/5 shadow-purple-950/5" : "bg-white border-slate-200 shadow-premium"
                      }`}
                    >
                      <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />
                      
                      <div className="border-b border-white/5 pb-3">
                        <h4 className={`font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                          <ShieldCheck className="w-4.5 h-4.5 text-purple-400" />
                          <span>Protection Core Score</span>
                        </h4>
                      </div>

                      <div className="flex flex-col items-center justify-center py-4 space-y-5">
                        {/* Circular Progress Ring with glow */}
                        <div className="relative w-36 h-36 flex items-center justify-center">
                          {/* Inner tech ring details */}
                          <div className="absolute inset-2.5 rounded-full border border-dashed border-white/10 animate-spin" style={{ animationDuration: "35s" }} />
                          <div className="absolute inset-5 rounded-full border border-white/5" />
                          
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="72" cy="72" r="58" fill="transparent" stroke={theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} strokeWidth="7" />
                            <motion.circle 
                              cx="72" 
                              cy="72" 
                              r="58" 
                              fill="transparent" 
                              stroke="url(#purpleCyanGrad)" 
                              strokeWidth="7" 
                              strokeDasharray="364" 
                              initial={{ strokeDashoffset: 364 }}
                              animate={{ strokeDashoffset: 65 }} // 82% filled
                              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
                              strokeLinecap="round" 
                            />
                            <defs>
                              <linearGradient id="purpleCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#a855f7" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center text-center">
                            <span className={`text-3xl font-black tracking-tighter ${theme === "dark" ? "text-white" : "text-navy-950"}`}>82%</span>
                            <span className="text-[8.5px] font-black text-cyan-400 uppercase tracking-widest mt-0.5">PROTECTED</span>
                          </div>
                        </div>

                        <div className="text-center space-y-1 w-full px-2">
                          <p className={`text-[11.5px] font-bold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>
                            Your family health cover matches. Add Smart Auto Shield to complete 360° security.
                          </p>
                          <div className="flex justify-center gap-3 pt-3">
                            <span className="inline-flex items-center gap-1 text-[8.5px] text-emerald-450 bg-emerald-950/40 border border-emerald-800/40 py-1 px-3 rounded-full font-black uppercase">
                              Health: Safe
                            </span>
                            <span className="inline-flex items-center gap-1 text-[8.5px] text-amber-500 bg-amber-950/40 border border-amber-800/40 py-1 px-3 rounded-full font-black uppercase">
                              Auto: Gap
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* 6. Dynamic User Profile Insight Card (Archetype Card) */}
                    <motion.div 
                      variants={cardVariants}
                      className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden transition-all duration-300 ${
                        theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200 shadow-premium"
                      }`}
                    >
                      {/* Top neon edge */}
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-650 via-cyan-400 to-indigo-650" />
                      
                      <div className="border-b border-white/5 pb-3">
                        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-0.5">AI Profile Insights</span>
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                          Sovereign Risk Archetype
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {/* Dynamic Archetype Title */}
                        <div className={`p-4 rounded-2xl border text-left space-y-2 relative overflow-hidden ${
                          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-slate-150 shadow-inner"
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-550 animate-pulse shadow-glow" />
                            <p className={`text-[12.5px] font-black leading-none ${theme === "dark" ? "text-cyan-300" : "text-purple-650"}`}>
                              &quot;{clientArchetype}&quot;
                            </p>
                          </div>
                          <p className={`text-[11.5px] leading-relaxed font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                            {getArchetypeExplanation(clientArchetype)}
                          </p>
                        </div>

                        {/* Visual Telemetry Bars */}
                        <div className="space-y-3.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
                              <span>Family Protection Priority</span>
                              <span className="text-purple-450">95%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "95%" }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-purple-550 rounded-full" 
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
                              <span>Risk Minimization Index</span>
                              <span className="text-cyan-400">80%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "80%" }}
                                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                                className="h-full bg-cyan-450 rounded-full" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* 7. Premium Quick-Action Cards Section */}
                    <div className="space-y-4 text-left">
                      <h4 className={`font-black text-xs sm:text-sm uppercase tracking-widest ${theme === "dark" ? "text-slate-400" : "text-navy-950"}`}>
                        Instant Protection Desks
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { title: "Protect Vehicle", icon: <Car className="w-5 h-5" />, symbol: "🚗", color: "hover:border-cyan-550/20 hover:shadow-cyan-950/10" },
                          { title: "Protect Family", icon: <Heart className="w-5 h-5" />, symbol: "❤️", color: "hover:border-rose-550/20 hover:shadow-rose-950/10" },
                          { title: "Travel Nomad", icon: <Globe className="w-5 h-5" />, symbol: "✈", color: "hover:border-purple-550/20 hover:shadow-purple-950/10" },
                          { title: "Secure Property", icon: <Layers className="w-5 h-5" />, symbol: "🏠", color: "hover:border-amber-550/20 hover:shadow-amber-950/10" },
                        ].map((act, i) => (
                          <motion.button
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={i}
                            onClick={() => setActiveNav("advisor")}
                            className={`p-4 border rounded-[22px] flex flex-col items-center justify-center text-center gap-3 transition-all duration-300 relative group cursor-pointer shadow-md ${
                              theme === "dark" 
                                ? `bg-slate-900/40 border-white/5 ${act.color}` 
                                : `bg-white border-slate-200/80 hover:border-slate-350`
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              {act.icon}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${theme === "dark" ? "text-slate-300" : "text-navy-950"}`}>
                              {act.title}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {/* VIEWPORT 2: PLANS PORTFOLIO */}
            {activeNav === "policies" && (
              <motion.div
                key="policies"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
                  theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                }`}
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Your Active Insurance Portfolio</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Fully locked and regulated under certified premium SaaS underwriting terms.</p>
                </div>

                <div className="space-y-6">
                  {activePoliciesList.map((plan, idx) => (
                    <div 
                      key={idx}
                      className={`p-6 border rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group ${
                        theme === "dark" ? "bg-white/[0.01] border-white/5 hover:border-purple-500/30 hover:bg-slate-900/20" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-950/40 text-purple-400 flex items-center justify-center flex-shrink-0 border border-purple-800/30">
                          <Heart className="w-6.5 h-6.5 stroke-[2.2]" />
                        </div>
                        <div className="text-left space-y-1.5">
                          <span className="bg-emerald-950/40 text-emerald-450 font-extrabold text-[9px] uppercase tracking-widest py-0.5 px-2.5 rounded-full border border-emerald-800/40 inline-block leading-none">
                            Active Scope
                          </span>
                          <h4 className={`text-base font-black group-hover:text-purple-400 transition-colors leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{plan.policyName}</h4>
                          <p className="text-xs text-slate-500 font-bold leading-normal">Authorized underwriter network partners locked securely.</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-left">
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Coverage Scope</span>
                          <span className={`text-sm font-extrabold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{plan.coverage || "₹1 Crore Cover"}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Rate Guarantee</span>
                          <span className="text-sm font-extrabold text-purple-400 block">₹{plan.premium || "850"} / month</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Claim Settlement</span>
                          <span className="text-sm font-extrabold text-emerald-450 block">99.2% Settled</span>
                        </div>
                      </div>

                      <button
                        onClick={() => router.push("/policies")}
                        className="bg-purple-650 hover:bg-purple-600 text-white font-bold py-3 px-5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20"
                      >
                        <span>Manage Package</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* VIEWPORT 3: AI ADVISOR */}
            {activeNav === "advisor" && (
              <motion.div
                key="advisor"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
                  theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                }`}
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Aegis Premium AI Consultant</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Empathetic underwriter intelligence matching risk packages automatically.</p>
                </div>

                <div className={`border rounded-3xl p-6 min-h-[380px] flex flex-col justify-between ${
                  theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-slate-150"
                }`}>
                  <div className="flex-grow space-y-5 overflow-y-auto max-h-[250px] pr-2 mb-6">
                    {chatMessages.map((msg) => {
                      const isAI = msg.sender === "ai";
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 max-w-[85%] ${isAI ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                            isAI ? "bg-purple-650/20 text-purple-300 border border-purple-500/20" : "bg-purple-600 text-white"
                          }`}>
                            {isAI ? "S" : "U"}
                          </div>
                          <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-semibold ${
                            isAI 
                              ? (theme === "dark" ? "bg-white/[0.02] border border-white/5 text-slate-350 shadow-sm" : "bg-white border border-slate-200 text-slate-700 shadow-sm") 
                              : "bg-purple-650 text-white"
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}

                    {isTyping && (
                      <div className="flex gap-3 max-w-[80%] mr-auto">
                        <div className="w-8 h-8 rounded-lg bg-purple-650/20 border border-purple-500/20 flex items-center justify-center font-bold text-xs text-purple-300">
                          S
                        </div>
                        <div className={`p-4 rounded-2xl flex items-center gap-1.5 shadow-sm border ${
                          theme === "dark" ? "bg-white/[0.02] border-white/5" : "bg-white border border-slate-200"
                        }`}>
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className={`flex gap-2 border rounded-2xl p-2.5 ${
                    theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-white border-slate-200"
                  }`}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask Aegis about life legacy cover, auto shields, or health extensions..."
                      className={`flex-1 bg-transparent px-3 outline-none text-[12px] font-semibold ${
                        theme === "dark" ? "text-white placeholder-slate-500" : "text-navy-950 placeholder-slate-400"
                      }`}
                    />
                    <button
                      type="submit"
                      className="bg-purple-650 hover:bg-purple-600 text-white py-2.5 px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-purple-500/20"
                    >
                      <span>Transmit Message</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* VIEWPORT 4: CLAIMS */}
            {activeNav === "claims" && (
              <motion.div
                key="claims"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
                  theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                }`}
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Secure Claim Safe-Track Portal</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Evaluating underwritten claims with decentralized authorization.</p>
                </div>

                <div className={`p-6 border rounded-3xl space-y-6 ${
                  theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-slate-150"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest bg-cyan-950/40 border border-cyan-800/40 py-1 px-3.5 rounded-full inline-block leading-none">
                        Admitted under Hospital Shield
                      </span>
                      <h4 className={`text-base font-black mt-2 ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Cashless Inpatient Claim #AEG-CLM-901</h4>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Target Settlement</p>
                      <p className="text-sm font-extrabold text-purple-400 mt-1">₹1,45,000 (Fully Approved)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                    {[
                      { step: 1, label: "Document Dispatch", desc: "Aegis Cloud verified", status: "done" },
                      { step: 2, label: "Hospital Desk Match", desc: "Cashless match cleared", status: "done" },
                      { step: 3, label: "Final Validation", desc: "Auditing items now", status: "active" },
                      { step: 4, label: "Settlement Settled", desc: "Direct payout desk", status: "pending" },
                    ].map((st) => (
                      <div key={st.step} className={`p-4 border rounded-2xl flex flex-col justify-between text-left space-y-3 relative group ${
                        theme === "dark" ? "bg-slate-900/60 border-white/5" : "bg-white border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            st.status === "done" 
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40" 
                              : st.status === "active" 
                              ? "bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 animate-pulse" 
                              : "bg-white/5 text-slate-550 border border-slate-200"
                          }`}>
                            {st.status === "done" ? <Check className="w-4 h-4 stroke-[3]" /> : st.step}
                          </div>
                          <span className={`text-[8.5px] font-black uppercase tracking-widest ${
                            st.status === "done" ? "text-emerald-400" : st.status === "active" ? "text-cyan-400 animate-pulse" : "text-slate-550"
                          }`}>
                            {st.status === "done" ? "Cleared" : st.status === "active" ? "Auditing" : "Pending"}
                          </span>
                        </div>
                        <div>
                          <p className={`text-[11px] font-extrabold leading-tight ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{st.label}</p>
                          <p className="text-[9px] text-slate-500 mt-1 font-semibold leading-none">{st.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEWPORT 5: VAULT */}
            {activeNav === "documents" && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
                  theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                }`}
              >
                <div className="border-b border-white/5 pb-4">
                  <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Secure Document Vault</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Encrypt and seed sovereign KYC ID assets directly into decentralized ledger storage.</p>
                </div>

                <div className={`border-2 border-dashed rounded-2xl py-10 px-6 text-center flex flex-col items-center justify-center gap-3 ${
                  theme === "dark" ? "border-white/10 bg-white/[0.01]" : "border-slate-200 bg-slate-50"
                }`}>
                  <input
                    type="file"
                    id="consumer-vault-picker"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingDoc}
                  />
                  <label htmlFor="consumer-vault-picker" className="w-12 h-12 rounded-xl bg-purple-950/50 text-purple-400 border border-purple-800/30 flex items-center justify-center cursor-pointer hover:bg-purple-900/30 transition-all">
                    <Upload className="w-6 h-6" />
                  </label>

                  <div className="space-y-1">
                    <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Click upload to deposit secure PDF KYC assets</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Decentralized DPDP locker protocol</p>
                  </div>

                  {uploadingDoc && (
                    <div className="text-[10px] text-purple-400 animate-pulse font-extrabold mt-2 uppercase tracking-widest">
                      Syncing digital vault blocks...
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="text-[11px] text-emerald-450 font-bold mt-2">
                      {uploadSuccess}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {uploadedFiles.map((doc) => (
                    <div key={doc.id} className={`p-4 border rounded-2xl flex items-center justify-between ${
                      theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className={`text-xs font-bold truncate ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{doc.name}</p>
                          <p className="text-[9px] text-slate-550 mt-0.5 leading-none font-semibold">{doc.size}</p>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex-shrink-0">{doc.date}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* VIEWPORT 6: NOTIFICATIONS */}
            {activeNav === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
                  theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
                }`}
              >
                <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Security Bulletins</h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Core system alerts compiled dynamically by Aegis model monitors.</p>
                  </div>
                  <button 
                    onClick={markAllNotificationsRead}
                    className="text-[9.5px] text-purple-450 hover:text-purple-400 underline font-black uppercase tracking-widest cursor-pointer"
                  >
                    Clear All Read
                  </button>
                </div>

                <div className="space-y-4">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
                        n.read 
                          ? "bg-white/[0.01] border-white/5 opacity-60" 
                          : "bg-purple-950/15 border-purple-500/20 shadow-lg"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        n.read ? "bg-white/5 text-slate-450" : "bg-purple-950/40 text-purple-400 border border-purple-800/30"
                      }`}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-grow text-left space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className={`text-xs font-black leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{n.title}</h4>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{n.time}</span>
                        </div>
                        <p className={`text-[11px] leading-normal font-semibold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      <Footer />
    </div>
  );
}
