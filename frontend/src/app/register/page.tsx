"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Shield, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

export default function RegisterPage() {
  const { register, loading } = useAuth();
  const { theme } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg("Please complete all security validation parameters.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password security protocol requires at least 6 characters.");
      return;
    }

    try {
      await register(name, email, password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to register secure credentials.");
    }
  };

  // Theme styling computed
  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";
  const mainCardClass = theme === "dark"
    ? "glass-card-dark-premium border-white/10"
    : "bg-white border-slate-200/80 shadow-2xl rounded-[32px] text-slate-800";

  const labelClass = theme === "dark" ? "text-slate-400" : "text-slate-500";

  const getInputClass = () => {
    if (theme === "dark") {
      return "bg-white/5 focus:bg-white/[0.08] border-white/10 focus:border-royal-500 text-white";
    } else {
      return "bg-slate-100/60 focus:bg-white border-slate-250 focus:border-royal-650 text-navy-900 shadow-inner";
    }
  };

  return (
    <div className={`min-h-screen relative flex flex-col justify-between transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Ambient background glows */}
      {theme === "dark" && (
        <>
          <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-royal-600/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />
        </>
      )}

      <section className="relative pt-32 pb-24 flex-grow flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border p-8 sm:p-10 relative overflow-hidden ${mainCardClass}`}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-royal-500 via-royal-600 to-cyan-400" />

            {/* Logo and Header info */}
            <div className="text-center mb-8 space-y-3">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border transition-all duration-300 ${theme === "dark"
                    ? "bg-gradient-to-tr from-slate-900 to-cyan-500 border-cyan-400/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "bg-gradient-to-tr from-navy-900 to-royal-600 border-white/20 text-white shadow-md"
                  }`}
              >
                <Shield className="w-7 h-7 stroke-[2]" />
              </motion.div>

              <h2 className="text-2xl font-black tracking-tight mt-4 text-inherit flex items-center justify-center leading-none">
                Establish Secure Shield
              </h2>

              <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest py-1 px-3.5 rounded-lg leading-none ${theme === "dark"
                  ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20"
                  : "text-royal-600 bg-royal-50 border border-royal-100"
                }`}>
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>Join Aegis Protection Net</span>
              </span>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 font-semibold mb-6 text-left"
              >
                {errorMsg}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-left">

              {/* Legal Name */}
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Full Legal Name:</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Aravind Sharma"
                    className={`w-full py-3.5 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                  />
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                </div>
              </div>

              {/* Security Email */}
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Security Email Address:</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@corporate.com"
                    className={`w-full py-3.5 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Vault Passcode Key:</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters passcode"
                    className={`w-full py-3.5 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                </div>
              </div>

              {/* Submit lock button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer ${theme === "dark"
                    ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                    : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Configuring Security Vault...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Aegis Credentials</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className={`mt-8 text-center border-t pt-6 ${theme === "dark" ? "border-white/5" : "border-slate-100"
              }`}>
              <p className={`text-xs font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                Already registered with Aegis?{" "}
                <Link href="/login" className={`font-black hover:underline ${theme === "dark" ? "text-cyan-400" : "text-royal-600"
                  }`}>
                  Unlock your vault
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
