"use client";

import Link from "next/link";
import { User, LogOut, LifeBuoy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CUSTOMER_HOME } from "@/lib/authRouting";
import { CONSUMER_HOME, LOGIN_ROUTE } from "@/lib/routes";

/**
 * Login trigger, or the dashboard/sign-out pair when authenticated.
 *
 * `onLoginClick` opens the landing page's modal. Only the landing page passes
 * it, so on every other page the button used to be wired to nothing at all and
 * silently did nothing when pressed. Without a handler it now navigates to the
 * sign-in page, which is what a button labelled "Login" has to do.
 */
export function AuthButtons({ onLoginClick }: { onLoginClick?: () => void }) {
  const { isAuthenticated, logout } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        {/* Aegis Consumer sits beside the dashboard rather than replacing it.
            The two serve different people — a console for someone who wants
            every panel, and a five-choice screen for someone who wants help —
            and which one a customer lands on by default is a product decision,
            not one to make silently from a nav component. The label is hidden
            on the narrowest screens so three controls still fit a phone. */}
        <Link
          href={CONSUMER_HOME}
          className="flex items-center gap-1.5 rounded-full border border-slate-250 bg-slate-100 py-2 px-4 text-xs font-black uppercase tracking-wider text-royal-600 transition-all hover:bg-slate-200 dark:border-cyan-400/30 dark:bg-white/[0.03] dark:text-cyan-300 dark:hover:bg-white/[0.08]"
        >
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Aegis Consumer</span>
          <span className="sr-only sm:hidden">Aegis Consumer</span>
        </Link>

        <Link
          // Straight to the dashboard, not through the /dashboard shim, so a
          // signed-in customer is not redirected on the way to their own page.
          href={CUSTOMER_HOME}
          className={`py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all border bg-slate-100 border-slate-250 text-royal-600 hover:bg-slate-200 dark:bg-white/[0.03] dark:border-cyan-400/30 dark:text-cyan-300 dark:hover:bg-white/[0.08]`}
        >
          <span>Dashboard</span>
        </Link>

        <button
          onClick={logout}
          className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider py-2 px-3.5 rounded-full border transition-all cursor-pointer bg-white border-slate-200 text-slate-600 hover:text-rose-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-rose-400`}
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    );
  }

  const loginClass = `flex items-center gap-2 text-xs font-black uppercase tracking-wider py-2 px-5 rounded-full border transition-all shadow-[0_4px_15px_rgba(168,85,247,0.25)] text-white cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-650 border-purple-500/20 hover:from-purple-500 hover:to-indigo-550`;

  if (!onLoginClick) {
    return (
      <Link href={LOGIN_ROUTE} className={loginClass}>
        <User className="w-4 h-4 stroke-[2.5]" />
        <span>Login</span>
      </Link>
    );
  }

  return (
    <button onClick={onLoginClick} className={loginClass}>
      <User className="w-4 h-4 stroke-[2.5]" />
      <span>Login</span>
    </button>
  );
}
