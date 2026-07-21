"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Heart, Car, Shield, Award, Plane, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function FloatingAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Delay visibility so it appears elegantly after page load
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const categories = [
    { label: "Family Shield", icon: Heart, href: "/advisor?category=family", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
    { label: "Motor Shield", icon: Car, href: "/advisor?category=motor", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { label: "Life Shield", icon: Shield, href: "/advisor?category=life", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { label: "Accident Vault", icon: Award, href: "/advisor?category=accident", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Travel Secure", icon: Plane, href: "/advisor?category=travel", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  ];

  // Theme styling computed
  const cardClass = "bg-white border-slate-200 shadow-2xl rounded-3xl text-slate-800 dark:glass-card-dark-premium dark:border-white/10 dark:text-white dark:shadow-none";

  const bubbleClass = "bg-slate-100 border-slate-200/80 text-slate-700 dark:bg-white/5 dark:border-white/5 dark:text-slate-200";

  const itemClass = "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 dark:hover:border-white/20 dark:text-white dark:shadow-none";

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

          {/* Expanded Consultation Card */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`mb-4 w-[330px] rounded-3xl overflow-hidden border shadow-2xl p-6 text-left relative transition-colors duration-300 ${cardClass}`}
              >
                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400 dark:hover:text-white`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Avatar & Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-royal-500 to-cyan-500 flex items-center justify-center text-white border border-white/10">
                      <Sparkles className="w-5 h-5 animate-pulse text-cyan-300" />
                    </div>
                    <span className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm text-content`}>Aegis Protection Vault</h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Active AI Concierge</p>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className={`rounded-2xl p-3 border mb-4 text-[12px] leading-relaxed transition-colors duration-300 ${bubbleClass}`}>
                  👋 Namaste! I am your unified AI Insurance Advisor. Select a protection shield below to start your personalized secure consultation.
                </div>

                {/* Selectors Grid */}
                <div className="flex flex-col gap-2 mb-4">
                  {categories.map((c, i) => {
                    const Icon = c.icon;
                    return (
                      <Link
                        key={i}
                        href={c.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${itemClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.color}`}>
                            <Icon className="w-4.5 h-4.5" />
                          </div>
                          <span className="text-xs font-semibold">{c.label}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    );
                  })}
                </div>

                {/* Secure Badge */}
                <div className="flex items-center gap-2 justify-center text-[10px] text-slate-500 font-medium">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Private to your account — never shared with agents</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Trigger Button */}
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            className="relative p-4 rounded-2xl bg-gradient-to-tr from-navy-950 to-royal-600 hover:from-royal-600 hover:to-cyan-500 text-white shadow-2xl border border-white/20 flex items-center justify-center cursor-pointer group"
          >
            {/* Pulsing Aura */}
            <span className="absolute inset-0 rounded-2xl bg-royal-500/20 blur-md group-hover:bg-cyan-400/20 transition-all animate-pulse" />

            <div className="relative flex items-center gap-2">
              {isOpen ? (
                <X className="w-5.5 h-5.5" />
              ) : (
                <>
                  <Sparkles className="w-5.5 h-5.5 text-cyan-300 animate-pulse" />
                  <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 ease-out whitespace-nowrap text-xs font-bold uppercase tracking-wider pl-0 group-hover:pl-1">
                    Talk with AI
                  </span>
                </>
              )}
            </div>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
