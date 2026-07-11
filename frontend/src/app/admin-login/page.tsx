"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Shield, Key, Lock, ArrowRight, Eye, EyeOff, 
  Cpu, Activity, ShieldAlert, Sparkles, Terminal
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

export default function AdminLoginPage() {
  const { login, loading, isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Redirect if already authenticated as Admin
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin" || user.role === "superadmin") {
        router.push("/admin-dashboard");
      } else {
        router.push("/consumer-dashboard");
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!userId.trim() || !password.trim()) {
      setErrorMsg("Security Violation: Company User ID and Password must be filled.");
      return;
    }

    // Convert standard User ID (e.g. "officer-01") to mock email in the background 
    // to preserve standard backend compatibility without breaking schemas
    let finalEmail = userId.trim();
    if (!finalEmail.includes("@")) {
      finalEmail = `${finalEmail}@aegis.com`;
    }

    try {
      // adminOnly: reject (and clear the session of) any non-admin account that
      // authenticates through the administrator portal.
      await login(finalEmail, password, { adminOnly: true });
      // login handles redirect
    } catch (err: any) {
      setErrorMsg(err.message || "Access Denied: Invalid Security Officer credentials.");
    }
  };

  const loadDemoAdmin = () => {
    setUserId("admin@aegis.com");
    setPassword("password123");
    setErrorMsg("Demo credentials synchronized. Press 'Authorize Access' to unlock dashboard.");
  };

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-900 text-white";

  const inputClass = "bg-slate-950 border-cyan-500/20 text-cyan-200 placeholder-slate-650 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

      {/* Cybermatrix ambient glow overlays */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-[30%] left-[-15%] w-[55%] h-[55%] rounded-full bg-cyan-600/5 blur-[130px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[10%] right-[-15%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[125px] pointer-events-none" />

      {/* Main Content Grid */}
      <section className="relative pt-32 pb-20 flex-grow flex items-center justify-center z-10">
        <div className="max-w-6xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* LEFT: ENTERPRISE COMMAND METRICS */}
          <div className="lg:col-span-7 text-left space-y-6">
            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest leading-none">
              <Terminal className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Sovereign Security Vault</span>
            </span>

            <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Enterprise <br/>
              <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent">
                Command Console
              </span>
            </h2>

            <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
              Protected digital workspace designed for risk controllers, security officers, and operations advisors. Access dynamic underwriting matrices and audit live fallbacks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              {[
                { title: "Active Encryption", desc: "DPDP compliance schemas enforce private vault directories.", icon: <Shield className="w-5 h-5 text-cyan-400" /> },
                { title: "Actuarial Telemetry", desc: "Real-time verification of LLM nodes and webhook queues.", icon: <Cpu className="w-5 h-5 text-purple-400" /> }
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-900/55 border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-3.5 mb-2">
                    {item.icon}
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">{item.title}</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: COMMAND LOGIN CARD */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-8 sm:p-10 rounded-[36px] border bg-slate-900/60 border-cyan-500/20 backdrop-blur-xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              {/* Pulsing neon top thread */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 animate-pulse" />

              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-white flex items-center justify-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-cyan-400" />
                  <span>Officer Portal</span>
                </h3>
                <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest block mt-2">
                  Enterprise Security Verification
                </span>
              </div>

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 font-semibold text-xs mb-6 text-left"
                >
                  {errorMsg}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                
                {/* Company User ID */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                    Company User ID (Email or Code):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="e.g. officer-042 or officer@aegis.com"
                      className={`w-full py-3.5 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
                    />
                    <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                    Vault Passcode:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full py-3.5 pl-11 pr-11 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                    
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center justify-center gap-2 border border-cyan-400/20 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying clearance...</span>
                    </>
                  ) : (
                    <>
                      <span>Authorize Access</span>
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Assist buttons */}
              <div className="mt-6 pt-4 border-t border-white/5 text-center flex items-center justify-between text-[10px] text-slate-500">
                <button 
                  type="button" 
                  onClick={loadDemoAdmin} 
                  className="hover:text-cyan-400 underline font-bold"
                >
                  Synchronize Demo Node
                </button>
                <Link href="/login" className="hover:text-purple-400 underline font-bold">
                  Client Vault Login
                </Link>
              </div>

            </motion.div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
