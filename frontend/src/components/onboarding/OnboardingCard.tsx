"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { ADVISORS } from "@/lib/advisors";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/shared/Spinner";
import { LANGUAGE_OPTIONS, INTEREST_OPTIONS, type LanguageId } from "@/lib/onboarding";
import { ChoiceCard } from "./ChoiceCard";
import type { OnboardingFlow } from "./useOnboardingFlow";

/** The Executive AI is a real member of the roster, not invented copy. */
const EXECUTIVE = ADVISORS.miscellaneous;

interface OnboardingCardProps {
  flow: OnboardingFlow;
  /** Shown in the greeting so it reads as a conversation, not a form. */
  customerName: string;
}

/**
 * The onboarding conversation.
 *
 * Three short screens rather than one long form: our audience includes
 * first-time buyers and senior citizens, and a wall of questions is where those
 * customers leave. Only two answers are ever required.
 */
export function OnboardingCard({ flow, customerName }: OnboardingCardProps) {
  const firstName = customerName.trim().split(/\s+/)[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "w-full max-w-lg rounded-[28px] border p-6 sm:p-8 backdrop-blur-2xl",
        "border-slate-200 bg-white shadow-premium",
        "dark:border-rose-500/20 dark:bg-slate-900/50 dark:shadow-[0_0_40px_rgba(244,63,94,0.10)]"
      )}
    >
      {/* Executive AI identity */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr text-sm font-black text-white shadow-lg",
            EXECUTIVE.theme
          )}
          aria-hidden
        >
          {EXECUTIVE.avatar}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-black text-slate-900 dark:text-white">
            {EXECUTIVE.name}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
            {EXECUTIVE.title}
          </p>
        </div>
      </div>

      {/* Progress — named, not just a bar, so the end is visible from the start */}
      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: flow.totalSteps }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= flow.stepIndex
                ? "bg-gradient-to-r from-rose-500 to-pink-500"
                : "bg-slate-200 dark:bg-white/10"
            )}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Step {flow.stepIndex + 1} of {flow.totalSteps}
      </p>

      <div className="mt-6 min-h-[280px]">
        {flow.step === "welcome" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black leading-tight text-slate-900 dark:text-white">
              Welcome to Aegis AI, {firstName}. 👋
            </h1>
            <div className="space-y-3 text-[14px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                I&apos;m {EXECUTIVE.name}, your Executive AI Manager. I&apos;ll set things up
                so the advice you get actually fits you.
              </p>
              <p>
                Two quick questions — about a minute — and then you&apos;re in. Nothing here
                is a commitment, and you can change any of it later.
              </p>
            </div>
          </div>
        )}

        {flow.step === "language" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Which language suits you best?
              </h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                Pick whichever you are most comfortable reading.
              </p>
            </div>
            <div className="space-y-2.5" role="radiogroup" aria-label="Preferred language">
              {LANGUAGE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.id}
                  role="radio"
                  label={option.label}
                  hint={option.hint}
                  selected={flow.language === option.id}
                  onSelect={() => flow.selectLanguage(option.id as LanguageId)}
                />
              ))}
            </div>
          </div>
        )}

        {flow.step === "interests" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                What brings you here?
              </h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                Pick as many as you like — this only decides who greets you first.
              </p>
            </div>
            <div className="space-y-2.5" role="group" aria-label="Insurance interests">
              {INTEREST_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.id}
                  role="checkbox"
                  glyph={option.emoji}
                  label={option.label}
                  hint={option.hint}
                  selected={flow.interests.includes(option.id)}
                  onSelect={() => flow.toggleInterest(option.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {flow.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {flow.error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        {flow.stepIndex > 0 && (
          <button
            type="button"
            onClick={flow.back}
            disabled={flow.submitting}
            className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-[12px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        )}

        <button
          type="button"
          onClick={flow.isLastStep ? flow.submit : flow.next}
          disabled={!flow.canAdvance || flow.submitting}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5",
            "text-[13px] font-black uppercase tracking-wider text-white transition-all",
            "bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
            "disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] touch-manipulation"
          )}
        >
          {flow.submitting ? (
            <>
              <Spinner className="h-4 w-4 border-2 border-white" />
              Setting up
            </>
          ) : (
            <>
              {flow.step === "welcome" ? "Let's begin" : flow.isLastStep ? "Finish" : "Continue"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
