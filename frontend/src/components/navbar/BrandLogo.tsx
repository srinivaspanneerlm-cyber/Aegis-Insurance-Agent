"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

/** Aegis AI logo and brand wordmark linking home. */
export function BrandLogo() {
  const brandTextClass = "text-content";

  return (
    <Link href="/" className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
      <div className="relative">
        <div className={`absolute inset-0 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity bg-royal-500 dark:bg-cyan-500`} />
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white border bg-gradient-to-tr from-navy-900 to-royal-600 border-white/20 shadow-sm dark:bg-gradient-to-tr dark:from-slate-900 dark:to-cyan-500 dark:border-white/10 dark:shadow-[0_0_15px_rgba(6,182,212,0.3)]`}>
          <Shield className={`w-5.5 h-5.5 stroke-[2] text-white dark:text-cyan-300`} />
        </div>
      </div>
      <div className="flex flex-col text-left">
        <span className={`text-lg font-black tracking-tight leading-none flex items-center gap-1 transition-colors duration-300 ${brandTextClass}`}>
          <span>Aegis</span>
          <span className={"text-royal-650 dark:text-cyan-400 dark:font-extrabold"}>AI</span>
        </span>
        <span className={`text-[8.5px] font-black tracking-widest uppercase mt-1 text-slate-400 dark:text-slate-500`}>
          AI Insurance Advisor
        </span>
      </div>
    </Link>
  );
}
