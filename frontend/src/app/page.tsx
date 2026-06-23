"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Shield, Mail, Lock, User, ArrowRight, Sparkles, Eye, EyeOff, 
  Heart, Activity, ShieldCheck, Check, Users, Award, Database, 
  Star, Headphones, X, Crown, Terminal, Laptop, Car, Plane, Home as HomeIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

// Dynamic Micro-Counter component for metric statistics
function LiveMetricCounter({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000; // 2 seconds duration
    const end = value;
    if (end === 0) return;
    
    const stepTime = Math.abs(Math.floor(duration / end));
    const timer = setInterval(() => {
      start += Math.ceil(end / 80);
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, Math.max(stepTime, 24));

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {decimals > 0 ? (count / 10).toFixed(decimals) : count.toLocaleString()}
      {suffix}
    </span>
  );
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export default function Home() {
  const { theme } = useTheme();
  const { login, loading, isAuthenticated, user } = useAuth();
  
  // Login Modal visibility
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Consumer Login Form values
  const [consumerEmail, setConsumerEmail] = useState("");
  const [consumerPassword, setConsumerPassword] = useState("");
  const [showConsumerPassword, setShowConsumerPassword] = useState(false);
  const [consumerError, setConsumerError] = useState("");
  const [consumerGoogleLoading, setConsumerGoogleLoading] = useState(false);

  // Admin Login Form values
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminGoogleLoading, setAdminGoogleLoading] = useState(false);

  const handleConsumerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsumerError("");

    if (!consumerEmail.trim() || !consumerPassword.trim()) {
      setConsumerError("Please fill in email and passcode parameters.");
      return;
    }

    try {
      await login(consumerEmail, consumerPassword);
      setIsLoginOpen(false);
    } catch (err: any) {
      setConsumerError(err.message || "Invalid credentials. Verify your vault keys.");
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAdminError("Please fill in admin email and passcode parameters.");
      return;
    }

    try {
      await login(adminEmail, adminPassword);
      setIsLoginOpen(false);
    } catch (err: any) {
      setAdminError(err.message || "Invalid admin credentials. Verify authorized keys.");
    }
  };

  // Google SSO simulated click
  const handleGoogleSimulate = (role: "consumer" | "admin") => {
    if (role === "consumer") {
      setConsumerGoogleLoading(true);
      setTimeout(() => {
        setConsumerGoogleLoading(false);
        setConsumerError("SSO Active: Complete password credentials to verify session.");
      }, 1200);
    } else {
      setAdminGoogleLoading(true);
      setTimeout(() => {
        setAdminGoogleLoading(false);
        setAdminError("Admin SSO Active: Complete password credentials to verify session.");
      }, 1200);
    }
  };

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      {/* Navbar with modal login callback */}
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />

      {/* Cyber ambient backgrounds & grid meshes */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-purple-650/10 blur-[130px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.05),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-royal-100/50 blur-[90px] pointer-events-none" />
        </>
      )}

      {/* --- HERO SECTION --- */}
      <section className="relative pt-36 pb-12 flex-grow flex items-center justify-center z-10">
        <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* LEFT SIDE HERO TEXT */}
          <div className="lg:col-span-6 text-left space-y-6">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
              The Future of <br/>
              <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                AI-Powered
              </span> <br/>
              Insurance Consultation
            </h1>
            
            <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
              Smart. Secure. Personalized. Experience the next generation of insurance guidance with Aegis AI. We audit policy coverage matrices instantly with zero agent cold calls.
            </p>

            <div className="flex items-center gap-3.5 pt-2">
              <button
                onClick={() => setIsLoginOpen(true)}
                className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                    : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                }`}
              >
                <span>Access Security Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <Link
                href="/advisor"
                className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                  theme === "dark" ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Consult Aegis AI
              </Link>
            </div>

            {/* Trust Deck items below title */}
            <div className="grid grid-cols-2 gap-4 pt-6 max-w-xl">
              {[
                { title: "AI-Powered Consultation", icon: <Sparkles className="text-cyan-400" /> },
                { title: "100% Secure & Trusted", icon: <ShieldCheck className="text-emerald-400" /> },
                { title: "Personalized for You", icon: <User className="text-royal-400" /> },
                { title: "24/7 AI Support", icon: <Activity className="text-rose-400" /> }
              ].map((badge, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                    theme === "dark" 
                      ? "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]" 
                      : "bg-white border-slate-200 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    theme === "dark" ? "bg-white/5 border border-white/10" : "bg-royal-50 border border-royal-100 shadow-inner"
                  }`}>
                    {badge.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                    {badge.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE HERO HOLOGRAPHIC SHIELD VISUAL */}
          <div className="lg:col-span-6 flex justify-center items-center relative">
            <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
              
              {/* Spinning dashboard outer rings */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
                className={`absolute w-[80%] h-[80%] rounded-full border border-dashed opacity-20 ${
                  theme === "dark" ? "border-cyan-400" : "border-royal-500"
                }`}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                className={`absolute w-[60%] h-[60%] rounded-full border border-double opacity-25 ${
                  theme === "dark" ? "border-purple-400 animate-pulse" : "border-indigo-400"
                }`}
              />

              {/* Glowing Background Light Shaft */}
              <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-80 bg-gradient-to-t from-cyan-500/10 via-purple-500/5 to-transparent blur-2xl rounded-t-full pointer-events-none" />

              {/* Holographic glowing Shield center */}
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                className={`relative w-44 h-44 rounded-[40px] flex flex-col items-center justify-center border-2 transition-all ${
                  theme === "dark" 
                    ? "bg-slate-900/60 border-cyan-400/40 text-cyan-300 shadow-[0_0_50px_rgba(6,182,212,0.4)]"
                    : "bg-white border-royal-400 text-royal-650 shadow-[0_15px_35px_rgba(59,130,246,0.15)]"
                }`}
              >
                <Shield className="w-20 h-20 stroke-[1.8]" />
                <span className="absolute text-2xl font-black text-white font-sans mt-[-4px]">A</span>

                {/* Simulated Family Silhouette sitting inside the shield beam */}
                <div className="absolute bottom-4 flex items-end gap-1 opacity-80 pointer-events-none">
                  {/* Father figure */}
                  <div className="w-1.5 h-6 bg-cyan-300 rounded-full" />
                  {/* Daughter figure */}
                  <div className="w-1 h-3 bg-cyan-200 rounded-full" />
                  {/* Mother figure */}
                  <div className="w-1.5 h-5.5 bg-cyan-300 rounded-full" />
                  {/* Son figure */}
                  <div className="w-1 h-3.5 bg-cyan-200 rounded-full" />
                </div>
              </motion.div>

              {/* Floating orbiting badges around the shield */}
              {[
                { icon: "🚗", delay: 0, x: -130, y: -70 },
                { icon: "❤️", delay: 1, x: 130, y: -70 },
                { icon: "👪", delay: 2, x: -130, y: 70 },
                { icon: "🔒", delay: 3, x: 130, y: 70 }
              ].map((badge, idx) => (
                <motion.div
                  key={idx}
                  animate={{ y: [badge.y, badge.y - 8, badge.y] }}
                  transition={{ repeat: Infinity, duration: 4, delay: badge.delay, ease: "easeInOut" }}
                  style={{ left: `calc(50% + ${badge.x}px - 22px)`, top: `calc(50% + ${badge.y}px - 22px)` }}
                  className={`absolute w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-all ${
                    theme === "dark" 
                      ? "bg-slate-900 border-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                      : "bg-white border-slate-200 text-slate-800 shadow-md"
                  }`}
                >
                  {badge.icon}
                </motion.div>
              ))}

            </div>
          </div>

        </div>
      </section>

      {/* --- STATISTICS FULL-WIDTH CAPSULE BAR --- */}
      <section className="relative px-6 pb-16 z-10">
        <div className={`max-w-7xl mx-auto p-6 rounded-[28px] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 ${
          theme === "dark"
            ? "bg-slate-950/60 border-white/5 shadow-2xl"
            : "bg-white border-slate-200 shadow-premium"
        }`}>
          {[
            { value: 50000, suffix: "+", label: "Happy Customers", icon: <Users className="w-4.5 h-4.5" />, color: "bg-purple-650/10 text-purple-400 border-purple-500/20" },
            { value: 95, suffix: "%", label: "Customer Satisfaction", icon: <ShieldCheck className="w-4.5 h-4.5" />, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            { value: 24, suffix: "/7", label: "AI Assistance", icon: <Headphones className="w-4.5 h-4.5" />, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            { value: 120, suffix: "Cr+", label: "Coverage Guided", icon: <Award className="w-4.5 h-4.5" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { value: 48, suffix: "/5", label: "Rating on Platform", icon: <Star className="w-4.5 h-4.5" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20", decimals: 1 }
          ].map((stat, idx) => (
            <div key={idx} className="flex items-center gap-4 text-left w-full md:w-auto justify-start md:justify-center border-r last:border-0 border-white/5 pr-4 last:pr-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <h3 className={`text-xl font-mono font-black ${theme === "dark" ? "text-white" : "text-navy-900"} leading-none`}>
                  <LiveMetricCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                </h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- AEGIS CONVERSATIONAL AI ECOSYSTEM --- */}
      <section className="relative px-6 py-16 z-10">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Sovereign Risk Underwriters</span>
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-white">
              Consult with Specialized AI Advisors
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Plans at Aegis are never static sheets. They are dynamically underwritten and custom-compiled in real time inside our secure digital vault. Connect with a specialized AI engine to start.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Alex AI",
                role: "Senior Asset Protection Engine",
                desc: "Specializes in vehicle valuation calculations, zero-depreciation matrices, and instant roadside recovery clearances.",
                icon: <Car className="w-6 h-6 text-cyan-400" />,
                bot: "Alex",
                color: "from-blue-600/20 to-cyan-500/20 hover:border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.05)]",
                telemetry: ["Zero-Dep Calculation", "Instant Garage Clearance", "Key Recovery Protocol"]
              },
              {
                name: "Sarah AI",
                role: "Lead Family Welfare Advisor",
                desc: "Focuses on growing family protection layers, zero co-pay medical underwriting, and cashless corporate beds allocation.",
                icon: <Heart className="w-6 h-6 text-purple-400" />,
                bot: "Sarah",
                color: "from-purple-650/20 to-indigo-500/20 hover:border-purple-400/40 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.05)]",
                telemetry: ["No Room-Rent Caps", "Pre-Existing Coverages", "Restoration Underwriting"]
              },
              {
                name: "Ethan AI",
                role: "Global Mobility & Safe Passage Engine",
                desc: "Expert on international evacuation logistics, worldwide travel coordinate security, and trip disruption settlements.",
                icon: <Plane className="w-6 h-6 text-rose-400" />,
                bot: "Ethan",
                color: "from-rose-600/20 to-amber-500/20 hover:border-rose-400/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.05)]",
                telemetry: ["Global Evacuation Lift", "Itinerary Delay Settlements", "Baggage Delay Coverage"]
              },
              {
                name: "Emma AI",
                role: "Real Estate Protection Specialist",
                desc: "Secures your private holdings and corporate physical assets against structural hazards, fire losses, and relocation needs.",
                icon: <HomeIcon className="w-6 h-6 text-emerald-400" />,
                bot: "Emma",
                color: "from-emerald-600/20 to-teal-500/20 hover:border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.05)]",
                telemetry: ["Fire Re-construction Cost", "Content Protection Vaults", "Temporary Relocation Limits"]
              }
            ].map((adv, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -8 }}
                className={`p-6 rounded-[28px] border bg-slate-900/60 border-white/5 flex flex-col justify-between text-left transition-all relative overflow-hidden group ${adv.color}`}
              >
                {/* Background glowing orb */}
                <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />

                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      {adv.icon}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 py-1 px-2.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">{adv.name}</h3>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {adv.role}
                    </span>
                  </div>

                  <p className="text-slate-400 text-xs leading-relaxed font-semibold">
                    {adv.desc}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Actuarial Telemetry</span>
                    <div className="flex flex-wrap gap-1.5">
                      {adv.telemetry.map((t, tIdx) => (
                        <span key={tIdx} className="text-[8.5px] font-black uppercase tracking-wide bg-white/5 text-slate-300 py-0.5 px-2 rounded-md">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 relative z-10">
                  <Link
                    href={`/advisor?bot=${encodeURIComponent(adv.bot)}`}
                    className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-white text-slate-950 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                  >
                    <span>Start Consultation</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* --- PREMIUM DYNAMIC TESTIMONIALS SECTION --- */}
      <Testimonials />

      {/* --- TRIGGERED LOGIN MODAL WITH TRIPLE CARD MATRIX --- */}
      <AnimatePresence>
        {isLoginOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md"
          >
            {/* Modal main box */}
            <motion.div
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              className="w-full max-w-6xl relative my-auto"
            >
              
              {/* Close trigger button */}
              <button
                onClick={() => setIsLoginOpen(false)}
                className={`absolute right-0 -top-12 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  theme === "dark" ? "bg-white/5 border-white/10 text-white hover:bg-white/15" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* COLUMN 1: WELCOME CARD (Cols 1-4) */}
                <div className="lg:col-span-4 flex flex-col">
                  <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left ${
                    theme === "dark" ? "bg-slate-900/60 border-white/5 shadow-2xl" : "bg-white border-slate-200 shadow-lg"
                  }`}>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className={`text-xl font-black flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-navy-900"}`}>
                          <span>Welcome to Aegis AI</span>
                          <span>👋</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                          Choose your login type
                        </p>
                      </div>

                      {/* Selection rows */}
                      <div className="space-y-3 pt-2">
                        {/* Consumer row */}
                        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          theme === "dark"
                            ? "bg-purple-950/20 border-purple-500/20 text-purple-300"
                            : "bg-purple-50 border-purple-100 text-purple-800"
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                              <User className="w-4.5 h-4.5" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-xs font-black">Consumer Login</h4>
                              <span className="text-[9px] font-bold opacity-60">For Customers</span>
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Admin row */}
                        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          theme === "dark"
                            ? "bg-cyan-950/20 border-cyan-500/20 text-cyan-300"
                            : "bg-cyan-50 border-cyan-100 text-cyan-800"
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                              <Crown className="w-4.5 h-4.5" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-xs font-black">Admin Login</h4>
                              <span className="text-[9px] font-bold opacity-60">For Companies</span>
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span className="text-emerald-500">🔒</span>
                      <span>Secure & Encrypted Connection</span>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: CONSUMER LOGIN CARD (Cols 5-8) */}
                <div className="lg:col-span-4 flex flex-col">
                  <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-900/60 border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]"
                      : "bg-white border-purple-200 shadow-xl"
                  }`}>
                    <div className="space-y-6">
                      
                      {/* Top icon and header */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-650 to-indigo-500 text-white flex items-center justify-center shadow-lg mb-3">
                          <User className="w-6 h-6" />
                        </div>
                        <h3 className={`text-base font-black ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Consumer Login</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Access your account</p>
                      </div>

                      {consumerError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold rounded-xl">
                          {consumerError}
                        </div>
                      )}

                      {/* Unique Small Google Icon Button */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleGoogleSimulate("consumer")}
                          disabled={consumerGoogleLoading}
                          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm relative group ${
                            theme === "dark" 
                              ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-purple-500/30 text-white" 
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-purple-400 text-slate-800"
                          }`}
                          title="Continue with Google"
                        >
                          {consumerGoogleLoading ? (
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <GoogleIcon />
                          )}
                          <span className="absolute -inset-1 rounded-full border border-purple-500/0 group-hover:border-purple-500/20 transition-all pointer-events-none scale-105" />
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center">
                        <div className={`flex-grow h-[1px] ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`} />
                        <span className="px-3.5 text-[8.5px] text-slate-500 font-black uppercase tracking-widest">or</span>
                        <div className={`flex-grow h-[1px] ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`} />
                      </div>

                      <form onSubmit={handleConsumerSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Email Address</label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              value={consumerEmail}
                              onChange={(e) => setConsumerEmail(e.target.value)}
                              placeholder="E.g., name@gmail.com"
                              className={`w-full py-3 pl-10 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${
                                theme === "dark" ? "bg-white/[0.03] border-white/10 text-white focus:bg-slate-900/60" : "bg-slate-100 border-slate-200 text-slate-800 focus:bg-white"
                              }`}
                            />
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Password</label>
                          <div className="relative">
                            <input
                              type={showConsumerPassword ? "text" : "password"}
                              required
                              value={consumerPassword}
                              onChange={(e) => setConsumerPassword(e.target.value)}
                              placeholder="••••••••"
                              className={`w-full py-3 pl-10 pr-10 rounded-xl border outline-none text-xs font-semibold transition-all ${
                                theme === "dark" ? "bg-white/[0.03] border-white/10 text-white focus:bg-slate-900/60" : "bg-slate-100 border-slate-200 text-slate-800 focus:bg-white"
                              }`}
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <button
                              type="button"
                              onClick={() => setShowConsumerPassword(!showConsumerPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showConsumerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
                            <input type="checkbox" className="rounded border-white/10" />
                            <span>Remember me</span>
                          </label>
                          <Link href="#" className="text-purple-400 hover:underline">Forgot Password?</Link>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-2 border border-purple-500/20 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-550 transition-all cursor-pointer mt-4"
                        >
                          {loading ? "Decrypting Vault..." : "Login to Account"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    </div>

                    <div className="pt-6 border-t border-white/5 text-center">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Don't have an account?{" "}
                        <Link href="/register" className="font-black text-purple-400 hover:underline">Register here</Link>
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3: ADMIN LOGIN CARD (Cols 9-12) */}
                <div className="lg:col-span-4 flex flex-col">
                  <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-900/60 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                      : "bg-white border-cyan-200 shadow-xl"
                  }`}>
                    <div className="space-y-6">
                      
                      {/* Top icon and header */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-lg mb-3">
                          <Crown className="w-5 h-5" />
                        </div>
                        <h3 className={`text-base font-black ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Admin Login</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Access admin dashboard</p>
                      </div>

                      {adminError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold rounded-xl">
                          {adminError}
                        </div>
                      )}

                      {/* Unique Small Google Icon Button */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleGoogleSimulate("admin")}
                          disabled={adminGoogleLoading}
                          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm relative group ${
                            theme === "dark" 
                              ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-cyan-500/30 text-white" 
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-cyan-400 text-slate-800"
                          }`}
                          title="Continue with Google"
                        >
                          {adminGoogleLoading ? (
                            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <GoogleIcon />
                          )}
                          <span className="absolute -inset-1 rounded-full border border-cyan-500/0 group-hover:border-cyan-500/20 transition-all pointer-events-none scale-105" />
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center">
                        <div className={`flex-grow h-[1px] ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`} />
                        <span className="px-3.5 text-[8.5px] text-slate-500 font-black uppercase tracking-widest">or</span>
                        <div className={`flex-grow h-[1px] ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`} />
                      </div>

                      <form onSubmit={handleAdminSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Email Address</label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              value={adminEmail}
                              onChange={(e) => setAdminEmail(e.target.value)}
                              placeholder="admin@aegis.com"
                              className={`w-full py-3 pl-10 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${
                                theme === "dark" ? "bg-white/[0.03] border-white/10 text-white focus:bg-slate-900/60" : "bg-slate-100 border-slate-200 text-slate-800 focus:bg-white"
                              }`}
                            />
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Password</label>
                          <div className="relative">
                            <input
                              type={showAdminPassword ? "text" : "password"}
                              required
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className={`w-full py-3 pl-10 pr-10 rounded-xl border outline-none text-xs font-semibold transition-all ${
                                theme === "dark" ? "bg-white/[0.03] border-white/10 text-white focus:bg-slate-900/60" : "bg-slate-100 border-slate-200 text-slate-800 focus:bg-white"
                              }`}
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
                            <input type="checkbox" className="rounded border-white/10" />
                            <span>Remember me</span>
                          </label>
                          <Link href="#" className="text-cyan-400 hover:underline">Forgot Password?</Link>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-2 border border-cyan-500/20 bg-gradient-to-r from-blue-600 to-cyan-550 hover:from-blue-500 hover:to-cyan-450 transition-all cursor-pointer mt-4"
                        >
                          {loading ? "Verifying Token..." : "Login to Admin"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    </div>

                    <div className="pt-6 border-t border-white/5 text-center">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Not an admin?{" "}
                        <button onClick={() => setConsumerEmail("admin@aegis.com")} className="font-black text-cyan-400 hover:underline cursor-pointer bg-transparent border-0 outline-none">
                          Go to Consumer Login
                        </button>
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
