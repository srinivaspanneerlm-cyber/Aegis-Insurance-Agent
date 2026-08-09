"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type SupportPayload } from "@/lib/api";

const OPEN_STATES = ["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "AWAITING_APPROVAL"];
const sum = (m: Record<string, number>, keys: string[]) =>
  keys.reduce((a, k) => a + (m[k] ?? 0), 0);

/**
 * Support.
 *
 * Complaints and appointments are counted apart because they mean opposite
 * things — one is somebody unhappy, the other is a booking — and a combined
 * "support volume" would hide a rising complaint rate behind a busy diary.
 */
export default function SupportPage() {
  const [data, setData] = useState<SupportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .support()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load support.");
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
        <h1 className="text-h1 font-bold tracking-tight text-content">Support</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Complaints and appointments across the operation.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Complaints open"
              value={sum(data.complaints, OPEN_STATES)}
              tone={sum(data.complaints, OPEN_STATES) > 0 ? "warning" : "success"}
              icon="mail"
            />
            <Stat
              label="Complaints resolved"
              value={data.complaints.RESOLVED ?? 0}
              tone="success"
              icon="check"
            />
            <Stat
              label="Appointments open"
              value={sum(data.appointments, OPEN_STATES)}
              icon="clock"
            />
            <Stat
              label="Past their due time"
              value={data.overdue}
              tone={data.overdue > 0 ? "danger" : "neutral"}
              icon="bolt"
            />
          </div>

          <p className="text-pretty text-caption text-content-muted">
            {data.satisfaction.reason} Needed: {data.satisfaction.needs}
          </p>

          <Panel title="Most recent">
            {data.recent.length === 0 ? (
              <Empty icon="check">No complaints or appointments have been raised.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Reference
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        What
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Customer
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((w) => (
                      <tr key={w.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4 text-caption tabular-nums text-content-secondary">
                          {w.reference}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-body-sm text-content">{w.title}</p>
                          <p className="text-caption text-content-muted">
                            {w.kind === "COMPLAINT" ? "Complaint" : "Appointment"}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {w.customer ? (
                            <Link
                              href={`/customers/${w.customer.id}`}
                              className="focus-ring rounded text-body-sm text-brand"
                            >
                              {w.customer.name}
                            </Link>
                          ) : (
                            <span className="text-caption text-content-muted">not linked</span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge tone={w.resolvedAt ? "success" : "neutral"}>{w.status}</Badge>
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
