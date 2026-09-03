"use client";

import { Bike, Car, FileText, Info, ShieldQuestion } from "lucide-react";
import { Card } from "@/components/ui";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import { policyTypeChoice, vehicleTypeChoice } from "@/lib/consumer/vocabulary";
import type { ConsumerPolicy } from "@/services/api";
import { RenewalStatusPill, daysRemainingLabel } from "./RenewalStatusPill";

/**
 * Policy DNA — everything Aegis knows about one policy, on one screen.
 *
 * The order is the order somebody asks the questions in: what is it, when does
 * it run out, what does that mean, and what should I do. Not the order the
 * fields happen to sit in the database.
 *
 * Two rules it will not break. The policy number is shown masked, exactly as
 * the API sends it — the full number is never in the browser at all. And the
 * guidance disclaimer is rendered from the same object as the status, so a
 * status cannot appear without it.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** `2026-09-08` → `8 September 2026`. A date nobody has to decode. */
function formatDate(value: string | null): string {
  if (!value) return "Not given";
  const [year, month, day] = value.split("-").map(Number);
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-content-subtle">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-sm font-semibold text-content">{children}</dd>
    </div>
  );
}

export function PolicyDnaCard({
  policy,
  locale = "en",
}: {
  policy: ConsumerPolicy;
  locale?: DocumentLocale;
}) {
  const vehicle = policy.vehicle;
  const VehicleIcon = vehicle?.vehicleType === "CAR" ? Car : Bike;
  const typeChoice = policyTypeChoice(policy.policyType);
  const kindChoice = vehicleTypeChoice(vehicle?.vehicleType ?? null);
  const daysLabel = daysRemainingLabel(policy.renewal);

  return (
    <Card padding="none" className="overflow-hidden">
      {/* The headline: what it is, and how urgent it is. Everything a customer
          came for should be readable without scrolling. */}
      <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <VehicleIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-content">
                {vehicle?.registrationNumber ?? "Vehicle not recorded"}
              </p>
              <p className="truncate text-xs font-medium text-content-muted">
                {[kindChoice ? localise(kindChoice.label, locale) : null, vehicle?.make, vehicle?.model]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          </div>
          <RenewalStatusPill renewal={policy.renewal} />
        </div>

        {daysLabel && (
          <p className="text-sm font-bold text-content" data-testid="days-remaining">
            {daysLabel}
          </p>
        )}
        <p className="text-sm font-medium leading-relaxed text-content-muted">
          {policy.copy.status}
        </p>
      </div>

      {/* The facts. */}
      <dl className="px-5 py-1">
        <Row label="Insurer">{policy.insurer ?? "Not given"}</Row>
        <Row label="Policy number">
          <span className="font-mono">{policy.policyNumberMasked ?? "Not given"}</span>
          {/* Said out loud, so a customer does not think we lost it. */}
          <span className="ml-2 text-xs font-medium text-content-subtle">
            (we only show the last few digits)
          </span>
        </Row>
        <Row label="Cover type">
          {typeChoice ? localise(typeChoice.label, locale) : "Not given"}
        </Row>
        <Row label="Runs out on">{formatDate(policy.expiryDate)}</Row>
        {policy.startDate && <Row label="Started on">{formatDate(policy.startDate)}</Row>}
        {policy.idv !== null && (
          <Row label="Vehicle value (IDV)">₹{policy.idv.toLocaleString("en-IN")}</Row>
        )}
        {policy.ncbPercent !== null && <Row label="No-claim bonus">{policy.ncbPercent}%</Row>}
      </dl>

      {/* What the cover type actually means. This is the part most customers
          have never been told, and it is the reason the page exists. */}
      {typeChoice && (
        <div className="mx-5 mb-4 flex gap-3 rounded-2xl bg-surface-sunken/60 p-4">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-content-subtle">
              What this means
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-content-muted">
              {localise(typeChoice.meaning, locale)}
            </p>
          </div>
        </div>
      )}

      {/* What to do about it. A status with no next step leaves somebody
          informed and stuck. */}
      <div className="mx-5 mb-4 flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">What to do next</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-content">
            {policy.copy.nextAction}
          </p>
        </div>
      </div>

      {/* Required beside every result. Rendered from the same object as the
          status, so the two cannot become separated. */}
      <p
        data-testid="guidance-disclaimer"
        className="flex gap-2 border-t border-line px-5 py-4 text-xs font-medium leading-relaxed text-content-subtle"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{policy.copy.disclaimer}</span>
      </p>
    </Card>
  );
}
