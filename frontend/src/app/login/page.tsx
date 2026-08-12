"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, ArrowRight, Eye, EyeOff,
  Heart
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { destinationForCurrentUrl } from "@/lib/authRouting";

export default function ConsumerLoginPage() {
  const { login, loginWithGoogle, loading, isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Google Identity Services, via the shared hook the homepage modal uses too.
  const google = useGoogleSignIn({
    onCredential: loginWithGoogle,
    onError: setErrorMsg,
    // No width here on purpose: the button measures the space it is given, so it
    // stays flush with the email and password fields at every viewport.
    appearance: { theme: theme === "dark" ? "filled_black" : "outline" },
  });

  // Already signed in? Nobody who has a session should be looking at a sign-in
  // form. Send them where they belong — the page they were originally after,
  // onboarding if they have not finished it, the dashboard otherwise — and
  // `replace`, so this screen does not sit in their history.
  useEffect(() => {
    if (isAuthenticated && user) router.replace(destinationForCurrentUrl(user));
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    try {
      await login(email, password);
      // login handles redirect
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "That email or password doesn't match. Please try again.");
    }
  };

  // Theme styling computed
  const wrapperClass = "bg-surface text-content";

  const mainCardClass = "bg-white/95 border-slate-200/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:bg-slate-900/40 dark:border-white/5 dark:backdrop-blur-xl dark:shadow-[0_30px_60px_rgba(0,0,0,0.4)]";

  const inputClass = "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-650 focus:ring-4 focus:ring-purple-500/5 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:bg-slate-900/60 dark:focus:border-purple-400 dark:focus:ring-2 dark:focus:ring-purple-500/10";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">

      {/* Soft warm gradients and grids */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.12),rgba(255,255,255,0))]" />
          <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.03),rgba(255,255,255,0))]" />
          <div className="absolute top-[10%] left-[-15%] w-[40%] h-[40%] rounded-full bg-purple-100/50 blur-[90px] pointer-events-none" />
        </>
      )}

      {/* Main Grid Content */}
      <section className="relative pt-32 pb-20 flex-grow flex items-center justify-center z-10">
        <div className="max-w-6xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* LEFT: EMOTIONAL BRAND INTRO */}
          <div className="lg:col-span-6 text-left space-y-6">
            <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest leading-none">
              <Heart className="w-3.5 h-3.5" />
              <span>Insurance explained in plain language</span>
            </span>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Insurance designed to <br/>
              <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                protect what matters.
              </span>
            </h1>

            <p className="text-slate-400 text-sm font-semibold max-w-md leading-relaxed">
              Sign in to see your plans. Aegis AI answers your questions in ordinary words, helps you choose cover that fits your family, and never adds a commission to the price.
            </p>

          </div>

          {/* RIGHT: CONSUMER LOGIN CARD */}
          <div className="lg:col-span-6 flex justify-center items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`w-full max-w-md p-8 sm:p-10 rounded-[36px] border relative overflow-hidden transition-all duration-300 ${mainCardClass}`}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-650 via-indigo-500 to-cyan-500" />

              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-white">Sign in</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                  Sign in to see your plans
                </p>
              </div>

              {/* Google login — official Google Identity Services button */}
              {google.status !== "unconfigured" ? (
                <div ref={google.containerRef} className="w-full min-h-[44px] [&>div]:!w-full" />
              ) : (
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                  Google sign-in is not configured. Use your email and password below.
                </p>
              )}
              {google.status === "unavailable" && (
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                  Google sign-in could not load. Use your email and password below.
                </p>
              )}

              <div className="flex items-center my-6">
                <div className={`flex-grow h-[1px] bg-slate-200 dark:bg-white/10`} />
                <span className="px-3.5 text-[8.5px] text-slate-500 font-black uppercase tracking-widest">
                  or use your email
                </span>
                <div className={`flex-grow h-[1px] bg-slate-200 dark:bg-white/10`} />
              </div>

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-semibold text-xs mb-6 text-left"
                >
                  {errorMsg}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-left">

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sri@example.com"
                      className={`w-full py-3.5 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border border-purple-500/20 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing you in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>
              </form>

              <div className={`mt-8 text-center border-t pt-6 border-slate-150 dark:border-white/5`}>
                <p className="text-xs font-semibold text-slate-500">
                  New to Aegis AI?{" "}
                  <Link href="/register" className="font-black hover:underline text-purple-400">
                    Register Securely
                  </Link>
                </p>
              </div>

            </motion.div>
          </div>

        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
