"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { needsOnboarding, routeForUser } from "@/lib/authRouting";
import { Spinner } from "@/components/shared/Spinner";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { useOnboardingFlow } from "@/components/onboarding/useOnboardingFlow";

/**
 * First-time onboarding — a protected route.
 *
 * Reachable only with a session, and only while it is still owed: anyone who
 * has already answered (or is staff) is redirected to where they belong, so the
 * screen cannot be revisited by typing the URL.
 */
export default function OnboardingPage() {
  const { user, loading, completeOnboarding } = useAuth();
  const router = useRouter();

  const flow = useOnboardingFlow({ onComplete: completeOnboarding });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!needsOnboarding(user)) router.replace(routeForUser(user));
  }, [user, loading, router]);

  if (loading || !user || !needsOnboarding(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Spinner className="h-10 w-10 border-rose-500" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-10">
      {/* Ambient backdrop, tinted to the Executive AI's rose accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.10),rgba(255,255,255,0))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-pink-500/10 blur-[120px]"
      />

      <div className="relative z-10 flex w-full justify-center">
        <OnboardingCard flow={flow} customerName={user.name} />
      </div>
    </main>
  );
}
