"use client";

import { User, ArrowRight, Crown } from "lucide-react";

/** Left column: welcome copy and the consumer/admin login-type rows. */
export function WelcomeCard() {
  return (
    <div className="lg:col-span-4 flex flex-col">
      <div className={`p-8 rounded-[32px] border flex-grow flex flex-col justify-between relative overflow-hidden text-left bg-white border-slate-200 shadow-lg dark:bg-slate-900/60 dark:border-white/5 dark:shadow-2xl`}>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className={`text-xl font-black flex items-center gap-2 text-content`}>
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
            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all bg-purple-50 border-purple-100 text-purple-800 dark:bg-purple-950/20 dark:border-purple-500/20 dark:text-purple-300`}>
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
            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all bg-cyan-50 border-cyan-100 text-cyan-800 dark:bg-cyan-950/20 dark:border-cyan-500/20 dark:text-cyan-300`}>
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
  );
}
