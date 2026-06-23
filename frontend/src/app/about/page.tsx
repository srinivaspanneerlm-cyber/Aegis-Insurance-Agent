"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, Heart, Car, Plane, Home as HomeIcon, 
  ArrowRight, Shield, Award, Star, MapPin, Navigation, Cpu, 
  Users, Activity, Database, Flame, Check, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

// Micro-Counter for achievements statistics
function MetricCounter({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const end = value;
    if (end === 0) return;
    
    const stepTime = Math.abs(Math.floor(duration / end));
    const timer = setInterval(() => {
      start += Math.ceil(end / 60);
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, Math.max(stepTime, 30));

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {decimals > 0 ? (count / 10).toFixed(decimals) : count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function AboutPage() {
  const { theme } = useTheme();
  const [activeRoadmap, setActiveRoadmap] = useState(0);

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";
  
  // Custom glassmorphic cards computed classes
  const glassCardClass = theme === "dark" 
    ? "bg-slate-900/40 border-white/5 shadow-2xl text-slate-300"
    : "bg-white border-slate-200/80 shadow-premium text-slate-700";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Cyber ambient backgrounds & grid meshes */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
          <div className="absolute top-[15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.04),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-royal-100/40 blur-[100px] pointer-events-none" />
        </>
      )}

      {/* --- HERO SECTION --- */}
      <section className="relative pt-36 pb-20 flex-grow flex items-center justify-center z-10">
        <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* LEFT SIDE HERO TEXT */}
          <div className="lg:col-span-6 text-left space-y-6">
            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Aegis Operations Command</span>
            </span>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
              Revolutionizing <br/>
              <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Insurance Through
              </span> <br/>
              Artificial Intelligence
            </h1>
            
            <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
              Aegis AI combines intelligent AI conversations, automation, and personalized protection guidance to redefine the future of insurance consultation.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <a
                href="#vision"
                className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                    : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                }`}
              >
                <span>Explore Our Vision</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              
              <Link
                href="/advisor"
                className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                  theme === "dark" ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Launch Consult
              </Link>
            </div>
          </div>

          {/* RIGHT SIDE FUTURISTIC STARTUP VISUAL */}
          <div className="lg:col-span-6 flex justify-center items-center relative">
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
              
              {/* Orb rings spinning */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                className={`absolute w-[85%] h-[85%] rounded-full border border-dashed opacity-10 ${
                  theme === "dark" ? "border-cyan-400" : "border-royal-500"
                }`}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
                className={`absolute w-[65%] h-[65%] rounded-full border border-double opacity-20 ${
                  theme === "dark" ? "border-purple-400" : "border-indigo-400"
                }`}
              />

              {/* Glowing Background Light Shaft */}
              <div className="absolute w-52 h-52 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-transparent blur-3xl rounded-full" />

              {/* Holographic Glowing AI Shield */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                className={`relative w-48 h-48 rounded-[38px] flex flex-col items-center justify-center border-2 transition-all ${
                  theme === "dark" 
                    ? "bg-slate-900/70 border-cyan-500/40 text-cyan-300 shadow-[0_0_40px_rgba(6,182,212,0.3)]"
                    : "bg-white border-royal-400 text-royal-650 shadow-[0_15px_30px_rgba(59,130,246,0.1)]"
                }`}
              >
                <Shield className="w-24 h-24 stroke-[1.5]" />
                <span className="absolute text-4xl font-extrabold text-white mt-[-2px]">A</span>
                
                {/* Floating internal dots */}
                <div className="absolute bottom-6 flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                </div>
              </motion.div>

              {/* Floating Orbiting Insurance Icons */}
              {[
                { icon: <Car className="w-4 h-4" />, delay: 0, x: -120, y: -70, color: "text-cyan-400" },
                { icon: <Heart className="w-4 h-4" />, delay: 1, x: 120, y: -70, color: "text-purple-400" },
                { icon: <Plane className="w-4 h-4" />, delay: 2, x: -120, y: 70, color: "text-rose-400" },
                { icon: <HomeIcon className="w-4 h-4" />, delay: 3, x: 120, y: 70, color: "text-emerald-400" }
              ].map((badge, idx) => (
                <motion.div
                  key={idx}
                  animate={{ y: [badge.y, badge.y - 8, badge.y] }}
                  transition={{ repeat: Infinity, duration: 4.5, delay: badge.delay, ease: "easeInOut" }}
                  style={{ left: `calc(50% + ${badge.x}px - 20px)`, top: `calc(50% + ${badge.y}px - 20px)` }}
                  className={`absolute w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                    theme === "dark" 
                      ? "bg-slate-900 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]" 
                      : "bg-white border-slate-200 shadow-premium"
                  }`}
                >
                  <div className={badge.color}>{badge.icon}</div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* --- STATISTICS/ACHIEVEMENTS PANEL --- */}
      <section className="relative px-6 py-10 z-10">
        <div className={`max-w-7xl mx-auto p-6 rounded-[28px] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 ${
          theme === "dark"
            ? "bg-slate-950/60 border-white/5 shadow-2xl"
            : "bg-white border-slate-200 shadow-premium"
        }`}>
          {[
            { value: 50000, suffix: "+", label: "AI Consultations", icon: <Users className="w-4.5 h-4.5" />, color: "bg-purple-650/10 text-purple-400 border-purple-500/20" },
            { value: 95, suffix: "%", label: "Customer Satisfaction", icon: <ShieldCheck className="w-4.5 h-4.5" />, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            { value: 24, suffix: "/7", label: "AI Assistance", icon: <Cpu className="w-4.5 h-4.5" />, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            { value: 120, suffix: "Cr+", label: "Coverage Guided", icon: <Award className="w-4.5 h-4.5" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { value: 48, suffix: "/5", label: "AI Experience Rating", icon: <Star className="w-4.5 h-4.5" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20", decimals: 1 }
          ].map((stat, idx) => (
            <div key={idx} className="flex items-center gap-4 text-left w-full md:w-auto justify-start md:justify-center border-r last:border-0 border-white/5 pr-4 last:pr-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <h3 className={`text-xl font-mono font-black ${theme === "dark" ? "text-white" : "text-navy-900"} leading-none`}>
                  <MetricCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                </h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 block">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- COMPANY INTRODUCTION CARD --- */}
      <section className="relative px-6 py-12 z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            whileHover={{ y: -4 }}
            className={`p-8 md:p-10 rounded-[32px] border text-center relative overflow-hidden transition-all ${
              theme === "dark" 
                ? "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_35px_rgba(6,182,212,0.05)]" 
                : "bg-white border-royal-200 shadow-premium"
            }`}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            <div className="space-y-4 max-w-2xl mx-auto">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
                <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">The Next-Generation AI Consulting Desk</h2>
              <p className={`text-sm md:text-base leading-relaxed font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                Aegis AI is a next-generation AI-powered insurance consultation ecosystem designed to simplify insurance guidance through intelligent conversations, personalized recommendations, and future-ready automation systems.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- COMPANY VISION & MISSION (Anchor: vision) --- */}
      <section id="vision" className="relative px-6 py-16 z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* VISION CARD */}
          <motion.div
            whileHover={{ y: -6 }}
            className={`p-8 rounded-[32px] border flex flex-col justify-between text-left relative overflow-hidden group ${glassCardClass}`}
          >
            <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-purple-500/5 blur-xl group-hover:scale-125 transition-transform" />
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white">Our Vision</h2>
              <p className="text-sm font-semibold leading-relaxed">
                To revolutionize the insurance industry through intelligent AI consultation, conversational automation, and personalized protection experiences for everyone.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Sovereign Actuarial Excellence</span>
            </div>
          </motion.div>

          {/* MISSION CARD */}
          <motion.div
            whileHover={{ y: -6 }}
            className={`p-8 rounded-[32px] border flex flex-col justify-between text-left relative overflow-hidden group ${glassCardClass}`}
          >
            <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-cyan-500/5 blur-xl group-hover:scale-125 transition-transform" />
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white">Our Mission</h2>
              <p className="text-sm font-semibold leading-relaxed">
                To make insurance simple, accessible, trustworthy, and AI-driven through conversational AI technology and intelligent automation workflows.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Direct Encrypted Vaults</span>
            </div>
          </motion.div>

        </div>
      </section>

      {/* --- WHY AEGIS AI SECTION --- */}
      <section className="relative px-6 py-12 z-10">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">The Startup Core Purpose</span>
            <h2 className="text-3xl font-black tracking-tight leading-none text-white">Why Aegis AI Exists</h2>
          </div>
          
          <p className={`text-sm sm:text-base leading-relaxed font-semibold max-w-2xl mx-auto ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
            Traditional insurance systems are often confusing, slow, and form-heavy. Aegis AI transforms the experience through intelligent AI conversations that guide users naturally toward the right protection solutions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-left">
            {[
              { title: "No Form Fatigue", desc: "No more filling out hundreds of tedious checkboxes. Conversational intake matches details seamlessly." },
              { title: "Zero Cold Calls", desc: "Consult in a private, encrypted digital vault. No agents will ever cold call or bother you." },
              { title: "Dynamic Underwriting", desc: "Pricing is mathematically underwritten in real-time based on real actuarial telemetry indices." }
            ].map((item, idx) => (
              <div key={idx} className={`p-6 rounded-2xl border ${glassCardClass} space-y-3`}>
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">{item.title}</h4>
                <p className="text-[11px] text-slate-400 leading-normal font-semibold">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOUNDER & LOCATION SECTION --- */}
      <section className="relative px-6 py-16 z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* LEFT: FOUNDER CARD (Cols 1-7) */}
          <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-[32px] border relative overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-purple-950/20 text-white shadow-[0_0_30px_rgba(168,85,247,0.08)] border-white/5">
            <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {/* Simulated Startup Founder futuristic photo avatar frame */}
                <div className="w-16 h-16 rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-650 via-slate-900 to-cyan-500 p-0.5 shadow-lg flex items-center justify-center overflow-hidden relative group">
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center font-black text-[8px] tracking-wider text-purple-300">
                    SIVAMARAN J
                  </div>
                  {/* Glowing micro visual */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/20 to-purple-500/20 group-hover:opacity-0 transition-opacity" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black text-white">Sivamaran J</h3>
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Founder & Chief Architect</span>
                </div>
              </div>

              <blockquote className="text-sm font-semibold italic text-slate-300 leading-relaxed border-l-2 border-purple-500/50 pl-4 py-1">
                "Founded by Sivamaran J, Aegis AI was created to redefine insurance consultation through conversational artificial intelligence and intelligent automation systems. We believe protection should be intuitive, highly secure, and emotionally intelligent."
              </blockquote>
            </div>

            <div className="pt-8 border-t border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Sovereign Visionary Alignment</span>
            </div>
          </div>

          {/* RIGHT: LOCATION CARD (Cols 8-12) */}
          <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-[32px] border relative overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950/20 text-white shadow-[0_0_30px_rgba(6,182,212,0.08)] border-white/5">
            <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />

            <div className="space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Sovereign Coordinates</span>
                <h3 className="text-xl font-black text-white">Salem, Tamil Nadu</h3>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">India</span>
              </div>
            </div>

            {/* Glowing Map SVG Visual Representation */}
            <div className="h-24 w-full border border-white/5 rounded-2xl bg-white/[0.02] relative overflow-hidden flex items-center justify-center p-2">
              {/* Spinning grid map mesh */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-ping" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              
              <span className="absolute bottom-2 right-3 text-[8.5px] font-mono text-slate-600 font-black uppercase tracking-wider">
                Active Node: IN-SLM
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* --- COMPANY VALUES SECTION --- */}
      <section className="relative px-6 py-16 z-10">
        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Actuarial Trust Pillars</span>
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-none">Core Operating Values</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Innovation", desc: "Constantly engineering state-of-the-art conversational pipelines and high-fidelity protection visualizers.", icon: <Sparkles className="w-5 h-5 text-cyan-400" /> },
              { title: "Trust", desc: "Every consulting session is completely encrypted inside your private browser session vault.", icon: <Shield className="w-5 h-5 text-purple-400" /> },
              { title: "Accessibility", desc: "No complex forms or tedious requirements. Speak, chat, and access protection seamlessly.", icon: <Users className="w-5 h-5 text-emerald-400" /> },
              { title: "AI Automation", desc: "Zero agent cold calls. Calculations are underwritten dynamically by deep statistical engine models.", icon: <Cpu className="w-5 h-5 text-rose-400" /> },
              { title: "Human-Centered", desc: "Designed around emotional intelligence and empathetic, trust-building user experiences.", icon: <Heart className="w-5 h-5 text-pink-400" /> },
              { title: "Intelligent Protection", desc: "Dynamic recommendations lock in exactly what you need, shielding asset boundaries perfectly.", icon: <Award className="w-5 h-5 text-amber-400" /> }
            ].map((v, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -6 }}
                className={`p-6 rounded-[28px] border text-left flex flex-col justify-between transition-all relative overflow-hidden group ${glassCardClass}`}
              >
                <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />
                <div className="space-y-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {v.icon}
                  </div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">{v.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-normal font-semibold">{v.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FUTURE ROADMAP SECTION --- */}
      <section className="relative px-6 py-16 z-10">
        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
              <Activity className="w-3.5 h-3.5" />
              <span>Projected Milestones</span>
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-none">Engineering Roadmap</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
            {/* TIMELINE LIST (Cols 1-5) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {[
                { title: "Voice AI Consultation", desc: "Full sovereign voice-signature underwriter streams.", phase: "Phase 1" },
                { title: "Conversational Automation", desc: "Heuristic-guided dynamic document verifications.", phase: "Phase 2" },
                { title: "AI Workflow Automation", desc: "Claim settlements triggered by AI execution nodes.", phase: "Phase 3" },
                { title: "Personalized Protection Systems", desc: "Real-time risk allocation dials matching life shifts.", phase: "Phase 4" },
                { title: "Autonomous Recommendations", desc: "Sovereign machine-learning underwritten portfolios.", phase: "Phase 5" },
                { title: "End-to-End Processing", desc: "Claims, lockups, payouts, and billing cleared inside vault.", phase: "Phase 6" }
              ].map((item, idx) => {
                const isActive = activeRoadmap === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveRoadmap(idx)}
                    className={`p-3.5 rounded-2xl flex items-center justify-between border text-left transition-all cursor-pointer ${
                      isActive 
                        ? "bg-gradient-to-r from-cyan-950/40 to-slate-900 border-cyan-500/40 text-cyan-300"
                        : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        isActive ? "bg-cyan-500 text-slate-950 shadow-glow" : "bg-white/5 border border-white/10 text-slate-400"
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-white">{item.title}</h4>
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500">{item.phase}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* TIMELINE BRIEF VISUAL (Cols 6-12) */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeRoadmap}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="p-8 rounded-[32px] border border-cyan-500/20 bg-slate-900/40 text-white shadow-[0_0_30px_rgba(6,182,212,0.06)] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl" />
                  
                  <div className="space-y-6 relative z-10 text-left">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 py-1.5 px-3.5 rounded-full border border-cyan-500/20">
                        Roadmap Stage 0{activeRoadmap + 1}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Lock Target: Q{activeRoadmap + 1} 2027
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-white">
                        {[
                          "Voice AI Consultation",
                          "Conversational Insurance Automation",
                          "AI Workflow Automation",
                          "Personalized AI Protection Systems",
                          "Autonomous Insurance Recommendations",
                          "End-to-End AI Insurance Processing"
                        ][activeRoadmap]}
                      </h3>
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-semibold">
                        {[
                          "Enabling seamless, encrypted real-time vocal consultation feeds inside Aegis Command. Actuarial engines perform complex biometric checks and voice signature lockdowns instantly.",
                          "Automating static policy verification templates into direct, multi-turn conversational intakes. Dynamic telemetry scanners compile user inputs and automatically clearance checklists.",
                          "Deploying sovereign workflow agents capable of orchestrating instant cashless approvals, vehicle depreciation calculations, and emergency evacuations with zero manual delays.",
                          "Developing persistent context engines that track household risk parameters and dynamically scale protection boundaries in real-time as users secure new properties or family layers.",
                          "Launching deep statistical machine-learning underwriters that perform mathematical risk evaluation and recommend custom protection packages autonomously.",
                          "Enabling the entire claim loop—from consultation intake to qualify lead conversion, cashless hospital bed settlement, and safe premium payment locks—all within the secure vault."
                        ][activeRoadmap]}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span>Calibrating Pipeline Nodes</span>
                      </span>
                      <span className="text-cyan-400">IN DEVELOPMENT</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
