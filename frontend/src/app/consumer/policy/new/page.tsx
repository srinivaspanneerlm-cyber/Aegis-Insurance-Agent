"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/shared/Spinner";
import { PolicyWizard } from "@/components/consumer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { consumerService } from "@/services/api";
import type { DocumentLocale } from "@/types/documents";

/**
 * Check My Policy — the manual entry flow.
 *
 * There is no upload here yet, and that is deliberate rather than a gap being
 * apologised for. Manual entry has to work on its own: extraction will fail on
 * a photograph taken in poor light, and a flow that only works when the machine
 * reads the certificate is a flow that fails the customer with the worst phone.
 *
 * On success the customer goes straight to the Policy DNA for what they just
 * entered — the answer they came for, not a list they then have to search.
 */
export default function NewPolicyPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();

  const locale = (user?.preferredLanguage ?? "en") as DocumentLocale;

  const handleSubmit = async (payload: Record<string, unknown>) => {
    const { policy } = await consumerService.createPolicy(
      payload,
      user?.preferredLanguage ?? undefined
    );
    router.push(`/consumer/policy/${policy.id}`);
  };

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

          <h1 className="mt-4 text-2xl font-bold text-content">Check my policy</h1>
          <p className="mt-1 flex items-start gap-2 text-sm font-medium leading-relaxed text-content-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              A few short questions about your motor insurance. Only you can see what you add, and
              you can change or remove any of it later.
            </span>
          </p>

          <div className="mt-8">
            {!isReady ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-8 w-8 border-2 border-brand" />
                <span className="sr-only">Loading</span>
              </div>
            ) : (
              <PolicyWizard
                locale={locale}
                onSubmit={handleSubmit}
                onCancel={() => router.push("/consumer")}
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
