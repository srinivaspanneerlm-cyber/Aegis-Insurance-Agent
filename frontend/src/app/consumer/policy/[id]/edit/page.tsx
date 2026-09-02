"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, PencilLine } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { EmptyState } from "@/components/ui";
import { PolicyWizard } from "@/components/consumer";
import { draftFromPolicy, vehicleChanged, type PolicyDraft } from "@/lib/consumer/policyForm";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { consumerService, type ConsumerPolicy } from "@/services/api";
import type { DocumentLocale } from "@/types/documents";

/**
 * Correcting a policy the customer already entered.
 *
 * The same six screens as adding one, pre-filled. A separate, denser "edit
 * form" would have been the usual shape and the wrong one here: the person
 * fixing a mistyped expiry date is the same person who found the original flow
 * approachable, and a second layout is a second thing to learn.
 *
 * Ownership is the API's answer, not this page's. A policy belonging to somebody
 * else comes back 404 and renders as "we could not find it" — which is the
 * honest wording from this customer's side, and the same thing they would see
 * for a policy they had deleted.
 *
 * The vehicle is saved through its own endpoint rather than nested in the policy
 * update. Nested details are matched by registration number, so correcting a
 * typo in a plate would create a second vehicle and leave the first one behind;
 * `PATCH /consumer/vehicles/:id` corrects the one the policy already points at.
 */
export default function EditPolicyPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const policyId = typeof params?.id === "string" ? params.id : "";

  const [policy, setPolicy] = useState<ConsumerPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const locale = (user?.preferredLanguage ?? "en") as DocumentLocale;

  const load = useCallback(async () => {
    if (!policyId) return;
    try {
      const data = await consumerService.getPolicy(policyId, user?.preferredLanguage ?? undefined);
      setPolicy(data.policy);
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

  // What was on the record when the form opened, kept so the vehicle is only
  // written to when it actually changed.
  const initialDraft: PolicyDraft | null = useMemo(
    () => (policy ? draftFromPolicy(policy) : null),
    [policy]
  );

  const handleSubmit = async (payload: Record<string, unknown>) => {
    if (!policy || !initialDraft) return;

    const { vehicle, ...policyFields } = payload as {
      vehicle?: Record<string, unknown>;
    } & Record<string, unknown>;

    // The vehicle first. If it fails, the policy is left as it was rather than
    // pointing at details the customer did not agree to.
    if (vehicle && policy.vehicle) {
      const submitted = { ...initialDraft, ...draftOfVehicle(vehicle) };
      if (vehicleChanged(submitted, initialDraft)) {
        await consumerService.updateVehicle(policy.vehicle.id, vehicle);
      }
    }

    // A policy with no vehicle on it cannot happen through this flow, but if the
    // record is old enough to have one, the nested form still creates it.
    const body = policy.vehicle ? policyFields : payload;

    await consumerService.updatePolicy(policyId, body, user?.preferredLanguage ?? undefined);
    router.push(`/consumer/policy/${policyId}`);
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
                <span className="sr-only">Loading this policy</span>
              </div>
            ) : missing || !policy || !initialDraft ? (
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
                <h1 className="text-2xl font-bold text-content">Correct these details</h1>
                <p className="mt-1 flex items-start gap-2 text-sm font-medium leading-relaxed text-content-muted">
                  <PencilLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Change anything that is wrong and save. Nothing is sent to an insurer — this is
                    your own record of what you hold.
                  </span>
                </p>

                <div className="mt-8">
                  <PolicyWizard
                    mode="edit"
                    locale={locale}
                    initialDraft={initialDraft}
                    policyNumberMasked={policy.policyNumberMasked}
                    onSubmit={handleSubmit}
                    onCancel={() => router.push(`/consumer/policy/${policyId}`)}
                  />
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

/** The submitted vehicle block, back in draft terms so it can be compared. */
function draftOfVehicle(vehicle: Record<string, unknown>): Partial<PolicyDraft> {
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  return {
    registrationNumber: text(vehicle.registrationNumber),
    vehicleType: text(vehicle.vehicleType) as PolicyDraft["vehicleType"],
    make: text(vehicle.make),
    model: text(vehicle.model),
  };
}
