"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { EmptyState } from "@/components/ui";
import { ConsentForm, RequestStatusCard } from "@/components/consumer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  consumerService,
  type ConsumerPolicy,
  type ConsentRecord,
  type RenewalRequest,
} from "@/services/api";
import type { DocumentLocale } from "@/types/documents";

/**
 * Help me renew.
 *
 * Three states, and the page is really about which one it is in. A customer
 * with no request sees the consent screen. A customer who already has one sees
 * where it has got to and how to stop it — not a second form, because a second
 * request would put two rows in front of two operators and the API would refuse
 * it anyway.
 *
 * Nothing here produces a price, a payment or a policy. The copy says so and
 * the flow ends at "somebody will get in touch", which is the whole promise.
 */
export default function RenewPolicyPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const policyId = typeof params?.id === "string" ? params.id : "";

  const [policy, setPolicy] = useState<ConsumerPolicy | null>(null);
  const [request, setRequest] = useState<RenewalRequest | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const locale = (user?.preferredLanguage ?? "en") as DocumentLocale;

  const load = useCallback(async () => {
    if (!policyId) return;
    try {
      const data = await consumerService.getPolicy(policyId, user?.preferredLanguage ?? undefined);
      setPolicy(data.policy);

      // An open request on *this* policy. Requests on the customer's other
      // policies are theirs to see elsewhere and are not this page's business.
      const [{ requests }, { consents: records }] = await Promise.all([
        consumerService.getRenewalRequests(),
        consumerService.getConsents(),
      ]);
      setRequest(
        requests.find((r) => r.policyId === policyId && r.status !== "CLOSED") ?? null
      );
      setConsents(records);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [policyId, user?.preferredLanguage]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  const handleSubmit = async (payload: {
    preferredChannel: "CALL" | "WHATSAPP" | "EMAIL";
    contactPhone?: string | null;
    alsoRemind: boolean;
    agreed: true;
  }) => {
    const result = await consumerService.requestRenewalHelp(
      policyId,
      payload,
      user?.preferredLanguage ?? undefined
    );
    setRequest(result.request);
    setConfirmation(result.message);
    // The consents were created server-side alongside the request, so they are
    // fetched rather than guessed at — withdrawing needs their real ids.
    setConsents((await consumerService.getConsents()).consents);
  };

  const handleWithdraw = async (consentId: string) => {
    const { message } = await consumerService.withdrawConsent(
      consentId,
      user?.preferredLanguage ?? undefined
    );
    setConfirmation(message);
    setConsents((await consumerService.getConsents()).consents);
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface text-content">
      <Navbar />

      <main id="main-content" className="flex-grow">
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-32 sm:px-6">
          <Link
            href={`/consumer/policy/${policyId}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to this policy
          </Link>

          <div className="mt-4">
            {!isReady || loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-8 w-8 border-2 border-brand" />
                <span className="sr-only">Loading</span>
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
                <h1 className="text-2xl font-bold text-content">Help me renew</h1>
                <p className="mt-1 text-sm font-medium leading-relaxed text-content-muted">
                  {policy.vehicle?.registrationNumber ?? "This policy"} ·{" "}
                  {policy.insurer ?? "Insurer not recorded"}
                </p>

                {confirmation && (
                  <p
                    role="status"
                    data-testid="renew-confirmation"
                    className="mt-4 flex gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{confirmation}</span>
                  </p>
                )}

                <div className="mt-8">
                  {request ? (
                    <RequestStatusCard
                      request={request}
                      consents={consents.filter((c) => c.policyId === policyId)}
                      locale={locale}
                      onWithdraw={handleWithdraw}
                    />
                  ) : (
                    <ConsentForm
                      locale={locale}
                      onSubmit={handleSubmit}
                      onCancel={() => router.push(`/consumer/policy/${policyId}`)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
