"use client";

import { useCallback, useMemo, useState } from "react";
import { MAX_INTERESTS, type LanguageId } from "@/lib/onboarding";

/**
 * The three-screen onboarding conversation, as state.
 *
 * Kept out of the page so the rules — you cannot advance without answering,
 * you cannot pick more than the server will accept — are testable without
 * rendering anything.
 */

export type OnboardingStep = "welcome" | "language" | "interests";

const ORDER: OnboardingStep[] = ["welcome", "language", "interests"];

export interface OnboardingFlow {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  language: LanguageId | null;
  interests: string[];
  submitting: boolean;
  error: string;
  /** False when the current screen has not been answered yet. */
  canAdvance: boolean;
  isLastStep: boolean;
  selectLanguage: (id: LanguageId) => void;
  toggleInterest: (id: string) => void;
  back: () => void;
  next: () => void;
  submit: () => Promise<void>;
}

export interface UseOnboardingFlowOptions {
  onComplete: (input: {
    preferredLanguage: string;
    insuranceInterests: string[];
  }) => Promise<void>;
}

export function useOnboardingFlow({ onComplete }: UseOnboardingFlowOptions): OnboardingFlow {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [language, setLanguage] = useState<LanguageId | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = ORDER.indexOf(step);
  const isLastStep = step === "interests";

  const canAdvance = useMemo(() => {
    if (step === "language") return language !== null;
    if (step === "interests") return interests.length > 0;
    return true; // the welcome screen asks nothing
  }, [step, language, interests]);

  const selectLanguage = useCallback((id: LanguageId) => {
    setError("");
    setLanguage(id);
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setError("");
    setInterests((current) => {
      if (current.includes(id)) return current.filter((i) => i !== id);
      if (current.length >= MAX_INTERESTS) return current;
      return [...current, id];
    });
  }, []);

  const back = useCallback(() => {
    setError("");
    setStep((s) => ORDER[Math.max(0, ORDER.indexOf(s) - 1)]);
  }, []);

  const next = useCallback(() => {
    setError("");
    setStep((s) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(s) + 1)]);
  }, []);

  const submit = useCallback(async () => {
    if (!language || interests.length === 0) {
      setError("Please answer both questions before continuing.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onComplete({ preferredLanguage: language, insuranceInterests: interests });
      // On success the caller navigates away; leave `submitting` set so the
      // button cannot be pressed twice during the redirect.
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error ? err.message : "We could not save that. Please try again."
      );
    }
  }, [language, interests, onComplete]);

  return {
    step,
    stepIndex,
    totalSteps: ORDER.length,
    language,
    interests,
    submitting,
    error,
    canAdvance,
    isLastStep,
    selectLanguage,
    toggleInterest,
    back,
    next,
    submit,
  };
}
