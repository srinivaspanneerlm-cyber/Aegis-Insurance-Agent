"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, Database, ShieldCheck, BarChart2,
  CheckCircle2, Cpu, BookOpen, MapPin, Globe, Home, Car,
} from "lucide-react";
import type { ThinkingStep } from "@/hooks/useStreaming";

// ── Step icon map ──────────────────────────────────────────────────────────────
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  init:        Brain,
  intent:      Brain,
  category:    Zap,
  agent:       Cpu,
  memory:      Database,
  knowledge:   BookOpen,
  profile:     Database,
  eligibility: CheckCircle2,
  policy_db:   Database,
  underwriting:ShieldCheck,
  risk:        BarChart2,
  risk_matrix: BarChart2,
  idv:         BarChart2,
  vehicle:     Car,
  valuation:   BarChart2,
  rec:         Zap,
  recommendation: Zap,
  executive:   ShieldCheck,
  board:       ShieldCheck,
  compliance:  ShieldCheck,
  governance:  ShieldCheck,
  destination: Globe,
  medical:     ShieldCheck,
  property:    Home,
  location:    MapPin,
};

// ── Theme colors per agent domain ──────────────────────────────────────────────
const DOMAIN_THEME: Record<string, { dot: string; ring: string; text: string; bg: string; border: string }> = {
  health:         { dot: "bg-emerald-400",  ring: "border-emerald-500/25", text: "text-emerald-300",  bg: "from-emerald-500/10 to-teal-500/5",    border: "border-emerald-500/20" },
  motor:          { dot: "bg-blue-400",     ring: "border-blue-500/25",    text: "text-blue-300",     bg: "from-blue-500/10 to-cyan-500/5",        border: "border-blue-500/20"    },
  travel:         { dot: "bg-violet-400",   ring: "border-violet-500/25",  text: "text-violet-300",   bg: "from-violet-500/10 to-purple-500/5",    border: "border-violet-500/20"  },
  "home-property":{ dot: "bg-amber-400",    ring: "border-amber-500/25",   text: "text-amber-300",    bg: "from-amber-500/10 to-orange-500/5",     border: "border-amber-500/20"   },
  executive:      { dot: "bg-rose-400",     ring: "border-rose-500/25",    text: "text-rose-300",     bg: "from-rose-500/10 to-pink-500/5",        border: "border-rose-500/20"    },
  miscellaneous:  { dot: "bg-rose-400",     ring: "border-rose-500/25",    text: "text-rose-300",     bg: "from-rose-500/10 to-pink-500/5",        border: "border-rose-500/20"    },
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface ThinkingEngineProps {
  active: boolean;
  currentStep: ThinkingStep | null;
  thinkingHistory: ThinkingStep[];
  agentName?: string;
  agentDomain?: string;
  advisorAvatar?: string;
  advisorTheme?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ThinkingEngine({
  active,
  currentStep,
  thinkingHistory,
  agentName = "Sarah AI",
  agentDomain = "health",
  advisorAvatar = "S",
  advisorTheme = "from-emerald-600 to-teal-500",
}: ThinkingEngineProps) {
  if (!active) return null;

  const theme = DOMAIN_THEME[agentDomain] || DOMAIN_THEME.health;
  const Icon = currentStep ? (STEP_ICONS[currentStep.step] || Brain) : Brain;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-3 w-full"
        >
          {/* Agent avatar */}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisorTheme} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-lg`}>
            {advisorAvatar}
          </div>

          {/* Thinking bubble */}
          <div className={`flex-1 min-w-0`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">{agentName}</p>
            <div className={`inline-block rounded-3xl rounded-tl-lg border bg-gradient-to-br ${theme.bg} ${theme.border} px-4 py-3.5 space-y-2.5 max-w-sm`}>
              {/* Animated dots header */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${theme.dot}`}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.2, 0.9] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
                  Reasoning
                </span>
              </div>

              {/* Current step */}
              <AnimatePresence mode="wait">
                {currentStep && (
                  <motion.div
                    key={currentStep.step}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Icon className={`w-3.5 h-3.5 ${theme.text} flex-shrink-0`} />
                    </motion.div>
                    <span className={`text-xs font-semibold ${theme.text}`}>
                      {currentStep.label}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent step trail */}
              {thinkingHistory.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {thinkingHistory.slice(-3).map((s, i) => {
                    const SIcon = STEP_ICONS[s.step] || Brain;
                    return (
                      <motion.div
                        key={`${s.step}-${i}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.35, scale: 1 }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5"
                      >
                        <SIcon className="w-2.5 h-2.5 text-white/25" />
                        <span className="text-[9px] text-white/25">
                          {s.label.replace(/\.\.\.$/, "")}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
