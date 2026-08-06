"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { platformApi, type LicenceRow } from "@/lib/api";

const EXPIRY_TONE = {
  EXPIRED: "danger",
  EXPIRING: "warning",
  CURRENT: "success",
  PERPETUAL: "neutral",
} as const;

/** Licence usage per tenant, with expiry derived rather than stored. */
export default function LicencesPage() {
  const [rows, setRows] = useState<LicenceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .licences()
      .then((d) => {
        if (!cancelled) setRows(d.licences);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">License Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Seats are staff accounts. Customers are the product&rsquo;s users, not its licensees.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      <Panel title={rows ? `${rows.length} organisation(s)` : "Loading"}>
        {rows === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon="briefcase">No organisations yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Organisation
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Plan
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Seats
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Expiry
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.organizationId} className="border-b border-line/30 last:border-0">
                    <td className="py-3 pr-4 text-body-sm text-content">{r.name}</td>
                    <td className="py-3 pr-4">
                      <Badge tone="info">{r.plan ?? "none"}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      <span className={r.seatsUsed > r.seats ? "font-semibold text-danger" : ""}>
                        {r.seatsUsed}
                      </span>{" "}
                      / {r.seats}
                    </td>
                    <td className="py-3">
                      <Badge tone={EXPIRY_TONE[r.expiryState]}>{r.expiryState}</Badge>
                      {r.expiresAt ? (
                        <span className="ml-2 text-caption text-content-muted">
                          {new Date(r.expiresAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-pretty text-caption text-content-muted">
        Billing is not implemented, which is why the platform reports no revenue. Seat counts cannot
        be reduced below the accounts that already exist — the API refuses, rather than silently
        putting a tenant over their limit.
      </p>
    </div>
  );
}
