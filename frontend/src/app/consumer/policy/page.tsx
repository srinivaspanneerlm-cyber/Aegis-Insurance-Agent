"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSearch, Info, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { EmptyState } from "@/components/ui";
import { PolicyListItem } from "@/components/consumer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { consumerService, type ConsumerPolicy } from "@/services/api";

/**
 * My Policies.
 *
 * Three states, all of them designed rather than defaulted: loading, nothing
 * yet, and a list. The empty state is the one that matters — it is what a new
 * customer sees first, and a blank page with a heading would tell them the
 * product is broken rather than that they have not started.
 */
export default function MyPoliciesPage() {
  const { user, isReady } = useRequireAuth();
  const [policies, setPolicies] = useState<ConsumerPolicy[]>([]);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await consumerService.getPolicies(user?.preferredLanguage ?? undefined);
      setPolicies(data.policies);
      setDisclaimer(data.disclaimer);
    } catch {
      setError("We could not load your policies just now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.preferredLanguage]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
      <Navbar />

      <main id="main-content" className="flex-grow">
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-32 sm:px-6">
          <Link
            href="/consumer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content">My Policies</h1>
              <p className="mt-1 text-sm font-medium text-content-muted">
                Everything you have told us about, and when each one runs out.
              </p>
            </div>
          </div>

          <div className="mt-6">
            {!isReady || loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-8 w-8 border-2 border-brand" />
                <span className="sr-only">Loading your policies</span>
              </div>
            ) : error ? (
              <EmptyState
                icon={<Info className="h-5 w-5" />}
                title="We could not load your policies"
                description={error}
                action={
                  <button
                    type="button"
                    onClick={() => { setLoading(true); void load(); }}
                    className="min-h-[48px] rounded-2xl bg-brand px-5 text-sm font-bold text-white"
                  >
                    Try again
                  </button>
                }
              />
            ) : policies.length === 0 ? (
              <EmptyState
                icon={<FileSearch className="h-5 w-5" />}
                title="No policies yet"
                description="Add your motor policy and we will tell you when it runs out and what it covers. It takes about a minute."
                action={
                  <Link
                    href="/consumer/policy/new"
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add my policy
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {policies.map((policy) => (
                    <li key={policy.id} className="flex">
                      <PolicyListItem policy={policy} />
                    </li>
                  ))}
                </ul>

                <Link
                  href="/consumer/policy/new"
                  className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm font-bold text-content-muted transition-colors hover:border-brand/50 hover:text-content"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add another policy
                </Link>

                {disclaimer && (
                  <p className="mt-6 flex gap-2 text-xs font-medium leading-relaxed text-content-subtle">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{disclaimer}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
