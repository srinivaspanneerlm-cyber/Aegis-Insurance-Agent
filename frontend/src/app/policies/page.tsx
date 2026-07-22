"use client";

import Link from "next/link";
import {
  Sparkles, Heart, Car, Plane, Home as HomeIcon,
  ArrowLeft, ArrowRight, ShieldCheck, Info,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import { PLANS_PER_CATEGORY } from "@/lib/platformFacts";

interface Category {
  category: string;
  advisor: string;
  role: string;
  desc: string;
  icon: React.ReactNode;
  bot: string;
  asks: string[];
  /** Per-category accent (theme-aware) for the icon, top bar and hover border. */
  bar: string;
  iconColor: string;
  hover: string;
}

const CATEGORIES: Category[] = [
  {
    category: "Motor Insurance",
    advisor: "Alex",
    role: "Vehicle cover specialist",
    desc: "Cover for your car or bike — from third-party basics to full protection. Add-ons like zero-depreciation and roadside help, explained in plain language.",
    icon: <Car className="w-7 h-7" />,
    bot: "Alex",
    asks: ["Your vehicle's age & model", "How much you drive", "Roadside help you want", "How you mainly use it"],
    bar: "bg-cyan-400",
    iconColor: "text-cyan-500 dark:text-cyan-400",
    hover: "hover:border-cyan-400/50",
  },
  {
    category: "Health Insurance",
    advisor: "Sarah",
    role: "Family health advisor",
    desc: "Medical cover for you and your family — hospital bills, cashless treatment, and room limits — without the jargon, and matched to your budget.",
    icon: <Heart className="w-7 h-7" />,
    bot: "Sarah",
    asks: ["Who's in your family", "Any existing conditions", "Room & treatment preferences", "Your monthly budget"],
    bar: "bg-purple-400",
    iconColor: "text-purple-500 dark:text-purple-400",
    hover: "hover:border-purple-400/50",
  },
  {
    category: "Travel Insurance",
    advisor: "Ethan",
    role: "Trip & travel advisor",
    desc: "Cover for trips at home and abroad — medical emergencies, trip cancellation, delays, and lost baggage — so a small problem doesn't ruin your journey.",
    icon: <Plane className="w-7 h-7" />,
    bot: "Ethan",
    asks: ["Where you're going", "How long the trip is", "Any adventure activities", "Medical cover level"],
    bar: "bg-rose-400",
    iconColor: "text-rose-500 dark:text-rose-400",
    hover: "hover:border-rose-400/50",
  },
  {
    category: "Property Insurance",
    advisor: "Emma",
    role: "Home & property advisor",
    desc: "Cover for your home and belongings — against fire, theft, and structural damage — whether you own your place or rent it.",
    icon: <HomeIcon className="w-7 h-7" />,
    bot: "Emma",
    asks: ["Your home size & type", "How old the building is", "Value of your belongings", "Location risks"],
    bar: "bg-emerald-400",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    hover: "hover:border-emerald-400/50",
  },
];

const STEPS = [
  "Choose the area you want to protect.",
  "Answer a few simple questions from the advisor.",
  "Get clear plan suggestions you can compare.",
];

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-surface text-content relative flex flex-col justify-between overflow-hidden transition-colors duration-300">
      <Navbar />
      <AmbientBackground variant="about" />

      <main id="main-content" className="relative pt-32 pb-24 z-10 flex-grow">
        <div className="max-w-7xl mx-auto px-6 space-y-14">

          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-muted hover:text-content transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to home</span>
              </Link>
            </div>

            <span className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Explore your cover</span>
            </span>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-content">
              Find the right cover for you
            </h1>
            <p className="text-content-muted text-sm leading-relaxed max-w-xl mx-auto">
              Pick the area you want to protect. A specialist AI advisor asks a few simple
              questions, then suggests plans that fit your needs and your budget — in plain
              language, with no jargon and no cold calls.
            </p>
          </div>

          {/* How it works */}
          <div className="max-w-4xl mx-auto p-6 rounded-[24px] border border-line bg-surface-raised flex flex-col md:flex-row items-start md:items-center gap-5 text-left shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-surface-sunken flex items-center justify-center border border-line flex-shrink-0">
              <Sparkles className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-content">How it works</h2>
              <ol className="grid gap-1.5 sm:grid-cols-3">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-content-muted leading-relaxed">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[9px] font-black flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Category cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {CATEGORIES.map((c) => (
              <motion.div
                key={c.category}
                whileHover={{ y: -6 }}
                className={`rounded-[32px] border border-line bg-surface-raised flex flex-col justify-between text-left transition-colors relative overflow-hidden shadow-sm ${c.hover}`}
              >
                <div className={`h-1 w-full ${c.bar}`} />

                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={`w-14 h-14 rounded-2xl bg-surface-sunken flex items-center justify-center border border-line ${c.iconColor}`}>
                      {c.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider py-1 px-3.5 rounded-full flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <span>{PLANS_PER_CATEGORY} plans to compare</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-content-subtle">Category</span>
                    <h3 className="text-2xl font-black text-content mt-0.5">{c.category}</h3>
                    <p className="text-[11px] text-content-muted font-bold uppercase tracking-wider mt-1">
                      {c.advisor} AI — {c.role}
                    </p>
                  </div>

                  <p className="text-content-muted text-sm leading-relaxed">
                    {c.desc}
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-line">
                    <span className="text-[9px] font-black uppercase tracking-wider text-content-subtle block">
                      What the advisor will ask about
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {c.asks.map((a) => (
                        <div key={a} className="flex items-center gap-2 text-[11px] text-content-muted font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/70 flex-shrink-0" />
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-8">
                  <Link
                    href={`/advisor?bot=${encodeURIComponent(c.bot)}`}
                    className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer bg-navy-900 hover:bg-navy-950 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  >
                    <span>Talk to {c.advisor}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Honest guidance note */}
          <div className="flex items-start justify-center gap-2 max-w-2xl mx-auto text-[11px] text-content-subtle leading-relaxed pt-2 text-center">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Aegis AI gives educational guidance to help you choose — it is not a policy
              document, and suggestions are non-binding. Always read the full terms before you buy.
            </span>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
