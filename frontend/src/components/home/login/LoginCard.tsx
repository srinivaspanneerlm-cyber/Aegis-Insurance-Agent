"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Crown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { GoogleIcon } from "./GoogleIcon";

export type LoginVariant = "consumer" | "admin";

/**
 * Per-variant class strings and copy. The consumer and admin cards are
 * structurally identical; only these accent classes, icon, and labels differ,
 * so they are captured here to guarantee output identical to the originals.
 */
const VARIANTS: Record<
  LoginVariant,
  {
    cardBorderDark: string;
    cardBorderLight: string;
    iconWrap: string;
    icon: ReactNode;
    title: string;
    subtitle: string;
    googleHoverDark: string;
    googleHoverLight: string;
    googleSpinner: string;
    googleGlow: string;
    emailPlaceholder: string;
    forgotColor: string;
    submit: string;
    loadingLabel: string;
    submitLabel: string;
  }
> = {
  consumer: {
    cardBorderDark: "border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]",
    cardBorderLight: "border-purple-200 shadow-xl",
    iconWrap: "bg-gradient-to-tr from-purple-650 to-indigo-500",
    icon: <User className="w-6 h-6" />,
    title: "Consumer Login",
    subtitle: "Access your account",
    googleHoverDark: "hover:border-purple-500/30",
    googleHoverLight: "hover:border-purple-400",
    googleSpinner: "border-purple-500",
    googleGlow: "border-purple-500/0 group-hover:border-purple-500/20",
    emailPlaceholder: "E.g., name@gmail.com",
    forgotColor: "text-purple-400",
    submit: "border-purple-500/20 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-550",
    loadingLabel: "Decrypting Vault...",
    submitLabel: "Login to Account",
  },
  admin: {
    cardBorderDark: "border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]",
    cardBorderLight: "border-cyan-200 shadow-xl",
    iconWrap: "bg-gradient-to-tr from-cyan-600 to-blue-500",
    icon: <Crown className="w-5 h-5" />,
    title: "Admin Login",
    subtitle: "Access admin dashboard",
    googleHoverDark: "hover:border-cyan-500/30",
    googleHoverLight: "hover:border-cyan-400",
    googleSpinner: "border-cyan-500",
    googleGlow: "border-cyan-500/0 group-hover:border-cyan-500/20",
    emailPlaceholder: "admin@aegis.com",
    forgotColor: "text-cyan-400",
    submit: "border-cyan-500/20 bg-gradient-to-r from-blue-600 to-cyan-550 hover:from-blue-500 hover:to-cyan-450",
    loadingLabel: "Verifying Token...",
    submitLabel: "Login to Admin",
  },
};

interface LoginCardProps {
  variant: LoginVariant;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  error: string;
  googleLoading: boolean;
  onGoogle: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  footer: ReactNode;
}

/** One credential login card (consumer or admin), driven by its variant. */
export function LoginCard({
  variant, email, setEmail, password, setPassword, showPassword, onTogglePassword,
  error, googleLoading, onGoogle, onSubmit, loading, footer,
}: LoginCardProps) {
  const { theme } = useTheme();
  const v = VARIANTS[variant];

  return (
    <div className="lg:col-span-4 flex flex-col">
      <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left transition-all duration-300 ${
        theme === "dark"
          ? `bg-slate-900/60 ${v.cardBorderDark}`
          : `bg-white ${v.cardBorderLight}`
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

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold rounded-xl">
              {error}
            </div>
          )}

          {/* Unique Small Google Icon Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onGoogle}
              disabled={googleLoading}
              className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm relative group ${
                theme === "dark"
                  ? `bg-white/[0.04] border-white/10 hover:bg-white/[0.08] ${v.googleHoverDark} text-white`
                  : `bg-slate-50 border-slate-200 hover:bg-slate-100 ${v.googleHoverLight} text-slate-800`
              }`}
              title="Continue with Google"
            >
              {googleLoading ? (
                <div className={`w-4 h-4 border-2 ${v.googleSpinner} border-t-transparent rounded-full animate-spin`} />
              ) : (
                <GoogleIcon />
              )}
              <span className={`absolute -inset-1 rounded-full border ${v.googleGlow} transition-all pointer-events-none scale-105`} />
            </button>
          </div>

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
