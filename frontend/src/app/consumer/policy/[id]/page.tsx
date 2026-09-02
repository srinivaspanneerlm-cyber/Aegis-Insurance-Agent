"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, MessageCircleQuestion, PencilLine, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { ConfirmDialog, EmptyState } from "@/components/ui";
import { HelpMeRenew, PolicyDnaCard, PolicyDocumentCard, TrustBadge } from "@/components/consumer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { consumerService, type ConsumerDocument, type ConsumerPolicy } from "@/services/api";
import type { DocumentLocale } from "@/types/documents";

/**
 * Policy DNA — one policy, explained.
 *
 * A policy that is not the customer's own comes back 404 from the API, and this
 * page renders that as "we could not find it" rather than as an error. That is
 * the honest wording: from this customer's side, it does not exist.
 */
export default function PolicyDetailPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const policyId = typeof params?.id === "string" ? params.id : "";

  const [policy, setPolicy] = useState<ConsumerPolicy | null>(null);
  const [document, setDocument] = useState<ConsumerDocument | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const locale = (user?.preferredLanguage ?? "en") as DocumentLocale;

  /**
   * The attached certificate, when the policy says there is one.
   *
   * Asked for separately, and its failure is not the policy's failure: a
   * customer whose certificate cannot be listed should still see everything else
   * about their cover rather than an error page. Skipped entirely when there is
   * nothing to fetch, which is the common case and one request fewer on a phone.
   */
  const loadDocument = useCallback(async (subject: ConsumerPolicy) => {
    if (!subject.trust.checks.documentAttached) {
      setDocument(null);
      return;
    }
    try {
      const { documents } = await consumerService.getDocuments(subject.id);
      setDocument(documents[0] ?? null);
    } catch {
      setDocument(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!policyId) return;
    try {
      const data = await consumerService.getPolicy(policyId, user?.preferredLanguage ?? undefined);
      setPolicy(data.policy);
      await loadDocument(data.policy);

      // Whether they have already asked for help with this one. Its failure is
      // not the policy's failure — the card simply offers rather than reports.
      try {
        const { requests } = await consumerService.getRenewalRequests();
        setRequestOpen(
          requests.some((r) => r.policyId === policyId && r.status !== "CLOSED")
        );
      } catch {
        setRequestOpen(false);
      }
    } catch {
      // Not found and not yours are the same answer, by design on the API side.
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [policyId, user?.preferredLanguage, loadDocument]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await consumerService.deletePolicy(policyId);
      router.push("/consumer/policy");
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
      <Navbar />

      <main id="main-content" className="flex-grow">
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-32 sm:px-6">
          <Link
            href="/consumer/policy"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My Policies
          </Link>

          <div className="mt-4">
            {!isReady || loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-8 w-8 border-2 border-brand" />
                <span className="sr-only">Loading this policy</span>
              </div>
            ) : missing || !policy ? (
              <EmptyState
                icon={<Info className="h-5 w-5" />}
                title="We could not find that policy"
                description="It may have been removed. Your other policies are still here."
                action={
                  <Link
                    href="/consumer/policy"
                    className="inline-flex min-h-[48px] items-center rounded-2xl bg-brand px-5 text-sm font-bold text-white"
                  >
                    Back to my policies
                  </Link>
                }
              />
            ) : (
              <>
                <h1 className="mb-4 text-2xl font-bold text-content">Your policy</h1>
                <PolicyDnaCard policy={policy} locale={locale} />

                <div className="mt-4 flex flex-col gap-4">
                  <HelpMeRenew policy={policy} locale={locale} requestOpen={requestOpen} />
                  <TrustBadge policy={policy} />
                  <PolicyDocumentCard
                    policyId={policy.id}
                    document={document}
                    locale={locale}
                    onUploaded={(result) => {
                      // The API answers with the policy, so the badge changes as
                      // the upload finishes rather than after a second round trip
                      // during which it would still say the old thing. Only the
                      // document list is fetched again, because only it is stale.
                      setPolicy(result.policy);
                      void loadDocument(result.policy);
                    }}
                  />
                </div>

                {/* Correcting comes before removing, and reads first. Somebody
                    who finds a wrong date here should reach the fix without
                    passing the destructive option to get to it. */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {/* Carries the policy, so an expiry question can be answered
                      about this one rather than in general. */}
                  <Link
                    href={`/consumer/ask?policyId=${policy.id}`}
                    data-testid="ask-about-policy"
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-line bg-surface-raised px-4 text-sm font-bold text-content transition-colors hover:border-brand/40"
                  >
                    <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                    Ask a question
                  </Link>

                  <Link
                    href={`/consumer/policy/${policy.id}/edit`}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-line bg-surface-raised px-4 text-sm font-bold text-content transition-colors hover:border-brand/40"
                  >
                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                    Correct these details
                  </Link>

                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-line px-4 text-sm font-bold text-content-muted transition-colors hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove this policy
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmingDelete}
        title="Remove this policy?"
        description="It will disappear from your list. You can add it again at any time, and we keep a record that you had it."
        confirmLabel={deleting ? "Removing…" : "Remove it"}
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <Footer />
    </div>
  );
}
