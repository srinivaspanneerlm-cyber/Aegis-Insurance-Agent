"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type RenewalsPayload } from "@/lib/api";

/**
 * Renewals, from both places they live.
 *
 * A renewal work item is one somebody has raised. A held policy whose renewal
 * date is approaching is one nobody has noticed yet, and those are precisely
 * the ones that lapse — so a screen showing only the queue would show the work
 * and hide the risk. Both are here, labelled as what they are.
 */
export default function RenewalsPage() {
  const [data, setData] = useState<RenewalsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .renewals()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load renewals.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Renewals</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Cover coming up for renewal, and the work raised against it.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Overdue first: a renewal date already passed is cover that may
                have lapsed while nobody was looking. */}
            <Stat
              label="Renewal date passed"
              value={data.overdue}
              tone={data.overdue > 0 ? "danger" : "success"}
              icon="clock"
            />
            <Stat
              label="Next 30 days"
              value={data.next30}
              tone={data.next30 > 0 ? "warning" : "neutral"}
              icon="refresh"
            />
            <Stat label="31–90 days" value={data.next90} icon="chart" />
            <Stat label="Cases raised" value={data.raised} icon="layers" />
          </div>

          <p className="text-pretty text-caption text-content-muted">
            {data.renewalRate.reason} Needed: {data.renewalRate.needs}
          </p>

          <Panel title="Coming up, next 90 days">
            {data.upcoming.length === 0 ? (
              <Empty icon="check">
                Nothing renews in the next 90 days. Policies appear here once a renewal date is
                recorded against them.
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Renews
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Policy
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Customer
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Premium
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming.map((p) => (
                      <tr key={p.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4 text-body-sm tabular-nums text-content">
                          {p.renewalDate
                            ? new Date(p.renewalDate).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-body-sm text-content">
                            {p.productName ?? p.domain}
                            {/* Cover held elsewhere is still a renewal
                                conversation, but it is not this tenant's to
                                renew — so it says which it is. */}
                            {p.external ? (
                              <span className="ml-2 text-caption font-normal text-content-muted">
                                held elsewhere
                              </span>
                            ) : null}
                          </p>
                          <p className="text-caption text-content-muted">
                            {p.insurer ?? "insurer not recorded"}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {p.profile?.user ? (
                            <Link
                              href={`/customers/${p.profile.user.id}`}
                              className="focus-ring rounded text-body-sm text-brand"
                            >
                              {p.profile.user.name}
                            </Link>
                          ) : (
                            <span className="text-caption text-content-muted">not linked</span>
                          )}
                        </td>
                        <td className="py-3 text-body-sm tabular-nums text-content-secondary">
                          {p.premium === null
                            ? "—"
                            : `₹${p.premium.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
