"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { AskPanel } from "@/components/consumer";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * Ask Aegis — the Kural Lite screen.
 *
 * Deliberately not `/advisor`. That is the full multi-agent conversation with a
 * language model behind it; this is six checked answers and nothing else, and
 * putting them on one screen would blur the only distinction that matters here
 * — whether what you are reading was written by somebody or generated for you.
 *
 * `?policyId=` arrives when a customer came from one of their own policies, and
 * it does one thing: an expiry question can then answer about that policy using
 * the renewal engine's own words. Everything else is general.
 */
function AskContent() {
  const { user, isReady } = useRequireAuth();
  const params = useSearchParams();
  const policyId = params.get("policyId");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-32 sm:px-6">
      <Link
        href={policyId ? `/consumer/policy/${policyId}` : "/consumer"}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-content">Ask about motor insurance</h1>
      <p className="mt-1 text-sm font-medium leading-relaxed text-content-muted">
        Six things explained in plain words. Free, and nothing is sold here.
      </p>

      <div className="mt-8">
        {!isReady ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8 border-2 border-brand" />
            <span className="sr-only">Loading</span>
          </div>
        ) : (
          <AskPanel policyId={policyId} locale={user?.preferredLanguage ?? undefined} />
        )}
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
      <Navbar />
      <main id="main-content" className="flex-grow">
        {/* `useSearchParams` needs a boundary, or the whole route opts out of
            static rendering and the shell flashes on every navigation. */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <Spinner className="h-8 w-8 border-2 border-brand" />
            </div>
          }
        >
          <AskContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
