"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import type { RefObject } from "react";
import type { GoogleSignInStatus } from "@/hooks/useGoogleSignIn";

/**
 * Accent classes and copy for the sign-in card.
 *
 * This used to be a lookup keyed by a `variant` prop, because the admin card was
 * structurally identical and differed only in these values. The customer portal
 * has no admin card, so the indirection is gone and the values are simply what
 * they are.
 */
const CARD = {
  borderDark: "border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]",
  borderLight: "border-purple-200 shadow-xl",
  iconWrap: "bg-gradient-to-tr from-purple-650 to-indigo-500",
  icon: <User className="w-6 h-6" />,
  title: "Sign in",
  subtitle: "Access your account",
  googleSpinner: "border-purple-500",
  googleGlow: "border-purple-500/0 group-hover:border-purple-500/20",
  emailPlaceholder: "E.g., name@gmail.com",
  forgotColor: "text-purple-400",
  submit: "border-purple-500/20 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-550",
  loadingLabel: "Decrypting Vault...",
  submitLabel: "Login to Account",
};

interface LoginCardProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  error: string;
  /** Google renders its own button into this element. */
  googleRef: RefObject<HTMLDivElement | null>;
  googleStatus: GoogleSignInStatus;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  footer: ReactNode;
}

/** The customer sign-in card. */
export function LoginCard({
  email, setEmail, password, setPassword, showPassword, onTogglePassword,
  error, googleRef, googleStatus, onSubmit, loading, footer,
}: LoginCardProps) {
  const { theme } = useTheme();
  const v = CARD;

  return (
    <div className="lg:col-span-5 flex flex-col">
      <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left transition-all duration-300 ${
        theme === "dark"
          ? `bg-slate-900/60 ${v.borderDark}`
          : `bg-white ${v.borderLight}`
      }`}>
        <div className="space-y-6">

          {/* Top icon and header */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full ${v.iconWrap} text-white flex items-center justify-center shadow-lg mb-3`}>
              {v.icon}
            </div>
            <h3 className={`text-base font-black text-content`}>{v.title}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{v.subtitle}</p>
          </div>

          {/* Reserved row: an error appearing must not resize the card and
              shift everything under the reader's cursor. */}
          <div className="min-h-[44px]" role="alert" aria-live="polite">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold rounded-xl dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-300">
                {error}
              </div>
            )}
          </div>

          {/* Continue with Google — this is Google's own button, rendered by
              Identity Services into the element below. It has to be theirs: a
              lookalike we style ourselves cannot produce a signed token, which
              is exactly the trap this card fell into before. */}
          {googleStatus !== "unconfigured" && (
            <div className="flex flex-col items-center gap-2">
              {/* Fixed height: Google injects an iframe once its script lands,
                  and without a reserved box the card jumps at that moment. */}
              <div className="relative flex h-11 items-center justify-center">
                <div ref={googleRef} className="flex items-center justify-center" />
                <span
                  className={`absolute -inset-1 rounded-full border ${v.googleGlow} transition-all pointer-events-none scale-105`}
                  aria-hidden
                />
                {googleStatus === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${v.googleSpinner} border-t-transparent animate-spin`}
                    />
                  </div>
                )}
              </div>
              {googleStatus === "unavailable" && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Google sign-in could not load. Use your email and password below.
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center">
            <div className={`flex-grow h-[1px] bg-slate-200 dark:bg-white/10`} />
            <span className="px-3.5 text-[8.5px] text-slate-500 font-black uppercase tracking-widest">or</span>
            <div className={`flex-grow h-[1px] bg-slate-200 dark:bg-white/10`} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={v.emailPlaceholder}
                  className={`w-full py-3 pl-10 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all bg-slate-100 border-slate-200 text-slate-800 focus:bg-white dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:focus:bg-slate-900/60`}
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8.5px] font-black uppercase tracking-widest text-slate-500 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full py-3 pl-10 pr-10 rounded-xl border outline-none text-xs font-semibold transition-all bg-slate-100 border-slate-200 text-slate-800 focus:bg-white dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:focus:bg-slate-900/60`}
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
                <input type="checkbox" className="rounded border-white/10" />
                <span>Remember me</span>
              </label>
              <Link href="#" className={`${v.forgotColor} hover:underline`}>Forgot Password?</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-2 border ${v.submit} transition-all cursor-pointer mt-4`}
            >
              {loading ? v.loadingLabel : v.submitLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="pt-6 border-t border-white/5 text-center">
          {footer}
        </div>
      </div>
    </div>
  );
}
