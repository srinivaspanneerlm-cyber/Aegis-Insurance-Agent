"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { megaMenuCategories } from "./navData";

/** Desktop holographic product mega-menu dropdown. */
export function MegaMenu({ isOpen }: { isOpen: boolean }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className={`absolute left-1/2 -translate-x-[45%] top-full mt-4 w-[90vw] max-w-6xl p-8 rounded-[36px] border text-left shadow-2xl backdrop-blur-3xl z-50 bg-white/95 border-slate-250/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:bg-slate-950/95 dark:border-white/10 dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]`}
        >
          {/* Visual glow details */}
          <div className="absolute top-0 left-1/4 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch relative z-10">
            {megaMenuCategories.map((cat, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-3xl border flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] bg-slate-50/50 border-slate-200/60 hover:bg-white hover:border-purple-400 shadow-sm dark:bg-white/[0.01] dark:border-white/5 dark:hover:bg-white/[0.03] dark:hover:border-cyan-400/25 dark:shadow-none`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cat.color}`}>
                      {cat.icon}
                    </div>
                    <h4 className={`text-xs font-black uppercase tracking-wider text-content`}>
                      {cat.title}
                    </h4>
                  </div>

                  {/* Subcategories */}
                  <ul className="space-y-2 mb-6">
                    {cat.subcategories.map((sub, sIdx) => (
                      <li
                        key={sIdx}
                        className={`text-[10.5px] font-semibold leading-relaxed flex items-center gap-1.5 transition-colors text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-cyan-300`}
                      >
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                        <span>{sub}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Consultation Button */}
                <Link
                  href={`/advisor?bot=${encodeURIComponent(cat.bot)}`}
                  className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1 shadow-sm border transition-all bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-cyan-500/10 dark:border-cyan-400/20 dark:text-cyan-300 dark:hover:bg-cyan-500/20`}
                >
                  <span>Talk With AI</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>

              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
