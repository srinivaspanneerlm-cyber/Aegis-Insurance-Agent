"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** Aegis AI logo and brand wordmark linking home. */
export function BrandLogo() {
  const { theme } = useTheme();
  const brandTextClass = theme === "dark" ? "text-white" : "text-navy-900";

  return (
    <Link href="/" className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
      <div className="relative">
        <div className={`absolute inset-0 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity ${
          theme === "dark" ? "bg-cyan-500" : "bg-royal-500"
        }`} />
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white border ${
          theme === "dark"
            ? "bg-gradient-to-tr from-slate-900 to-cyan-500 border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            : "bg-gradient-to-tr from-navy-900 to-royal-600 border-white/20 shadow-sm"
        }`}>
          <Shield className={`w-5.5 h-5.5 stroke-[2] ${theme === "dark" ? "text-cyan-300" : "text-white"}`} />
        </div>
      </div>
      <div className="flex flex-col text-left">
        <span className={`text-lg font-black tracking-tight leading-none flex items-center gap-1 transition-colors duration-300 ${brandTextClass}`}>
          <span>Aegis</span>
          <span className={theme === "dark" ? "text-cyan-400 font-extrabold" : "text-royal-650"}>AI</span>
        </span>
        <span className={`text-[8.5px] font-black tracking-widest uppercase mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
          AI Insurance Advisor
        </span>
      </div>
    </Link>
  );
}
