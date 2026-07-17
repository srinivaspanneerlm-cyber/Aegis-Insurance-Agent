"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Crown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

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

/** Simulated SSO delay before prompting for password (ms). */
const SSO_SIMULATE_DELAY = 1200;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Triple-card login modal (welcome / consumer / admin) triggered from the
 * navbar and hero. Owns all of its own form state so the landing page no longer
 * has to; login itself is delegated to `AuthContext`.
 */
export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { theme } = useTheme();
  const { login, loading } = useAuth();

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
      onClose();
    } catch (err) {
      setConsumerError(err instanceof Error ? err.message : "Invalid credentials. Verify your vault keys.");
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
      onClose();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Invalid admin credentials. Verify authorized keys.");
    }
  };

  // Google SSO simulated click
  const handleGoogleSimulate = (role: "consumer" | "admin") => {
    if (role === "consumer") {
      setConsumerGoogleLoading(true);
      setTimeout(() => {
        setConsumerGoogleLoading(false);
        setConsumerError("SSO Active: Complete password credentials to verify session.");
      }, SSO_SIMULATE_DELAY);
    } else {
      setAdminGoogleLoading(true);
      setTimeout(() => {
        setAdminGoogleLoading(false);
        setAdminError("Admin SSO Active: Complete password credentials to verify session.");
      }, SSO_SIMULATE_DELAY);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
              onClick={onClose}
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
                      Don&apos;t have an account?{" "}
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
  );
}
