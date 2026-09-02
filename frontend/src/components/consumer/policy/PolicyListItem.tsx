"use client";

import Link from "next/link";
import { Bike, Car, ChevronRight } from "lucide-react";
import type { ConsumerPolicy } from "@/services/api";
import { RenewalStatusPill, daysRemainingLabel } from "./RenewalStatusPill";
import { TrustPill } from "./TrustBadge";

/**
 * One policy in the list.
 *
 * Leads with the vehicle number, because that is what somebody recognises their
 * own policy by — not the insurer, and certainly not a masked policy number.
 * The status pill and the days-remaining line sit together so the answer to
 * "which of these needs me?" is readable without opening anything.
 */
export function PolicyListItem({ policy }: { policy: ConsumerPolicy }) {
  const VehicleIcon = policy.vehicle?.vehicleType === "CAR" ? Car : Bike;
  const daysLabel = daysRemainingLabel(policy.renewal);

  return (
    <Link
      href={`/consumer/policy/${policy.id}`}
      data-testid={`policy-row-${policy.id}`}
      className="flex min-h-[88px] items-center gap-3 rounded-4xl border border-line bg-surface-raised p-4 shadow-elevation-1 transition-all hover:border-brand/40 hover:shadow-elevation-2 active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <VehicleIcon className="h-5 w-5" aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-bold text-content">
          {policy.vehicle?.registrationNumber ?? "Vehicle not recorded"}
        </span>
        <span className="truncate text-xs font-medium text-content-muted">
          {policy.insurer ?? "Insurer not recorded"}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <RenewalStatusPill renewal={policy.renewal} />
          {daysLabel && (
            <span className="text-xs font-semibold text-content-muted">{daysLabel}</span>
          )}
          {/* Only when it is worth saying. A row repeating "as you entered it"
              on every policy trains people to stop reading the line that
              matters on the one policy where it does. */}
          {policy.trust.state !== "UPLOADED" && <TrustPill state={policy.trust.state} />}
        </span>
      </span>

      <ChevronRight className="h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
    </Link>
  );
}
