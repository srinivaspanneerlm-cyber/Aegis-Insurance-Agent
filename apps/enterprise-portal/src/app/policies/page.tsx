"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type PoliciesPayload } from "@/lib/api";

const STATUSES = ["ACTIVE", "LAPSED", "EXPIRED", "CANCELLED"];

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  LAPSED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
};

const money = (v: number | null) =>
  v === null ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * The book: policies customers actually hold.
 *
 * Not the catalogue — that is Products, and it is what the tenant offers rather
 * than what anybody bought. The distinction this page insists on is `external`:
 * cover a customer declared they hold elsewhere is still cover, and counting it
 * as this tenant's book would overstate the business by however many policies
 * their customers bought from somebody else. Both are shown, apart.
 */
export default function PoliciesPage() {
  const [data, setData] = useState<PoliciesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const ticket = useRef(0);

  const load = useCallback(async (which: string | null) => {
    const mine = ++ticket.current;
    setError(null);
    try {
      const d = await consoleApi.policies(which ?? undefined);
      if (mine === ticket.current) setData(d);
    } catch (e) {
      if (mine === ticket.current)
        setError(e instanceof Error ? e.message : "Could not load the book.");
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Policy Management</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          Cover your customers hold. What you offer is in{" "}
          <Link
            href="/products"
            className="focus-ring rounded text-brand underline underline-offset-4"
          >
            Products
          </Link>
          .
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Policies on file" value={data.total} icon="shield" />
            <Stat label="Sold by you" value={data.sold} tone="success" icon="briefcase" />
            {/* Named for what it is. "Total policies" would read as the book. */}
            <Stat label="Held elsewhere" value={data.held} icon="building" />
            <Stat
              label="Renewing in 90 days"
              value={data.renewingSoon}
              tone={data.renewingSoon > 0 ? "warning" : "neutral"}
              icon="refresh"
            />
          </div>

          <p className="text-pretty text-caption text-content-muted">
            {data.bookValue.reason} A book value would be a list price rather than money received.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus(null)}
              aria-pressed={status === null}
              className={
                status === null
                  ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1 text-caption font-medium text-content"
                  : "focus-ring rounded-control border border-line/50 px-3 py-1 text-caption text-content-secondary"
              }
            >
              All
            </button>
            {STATUSES.filter((sv) => (data.byStatus[sv] ?? 0) > 0).map((sv) => (
              <button
                key={sv}
                type="button"
                onClick={() => setStatus(sv)}
                aria-pressed={status === sv}
                className={
                  status === sv
                    ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1 text-caption font-medium text-content"
                    : "focus-ring rounded-control border border-line/50 px-3 py-1 text-caption text-content-secondary"
                }
              >
                {sv} · {data.byStatus[sv]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <Panel title={data ? `${data.policies.length} shown` : "Loading"}>
        {!data ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.policies.length === 0 ? (
          <Empty icon="shield">
            {status
              ? "No policies in that state."
              : "No policies are recorded yet. They appear here once customers declare cover or buy it."}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Policy
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Sum insured
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Premium
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Renews
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.policies.map((p) => (
                  <tr key={p.id} className="border-b border-line/30 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-body-sm text-content">
                        {p.productName ?? p.domain}
                        {p.external ? (
                          <span className="ml-2 text-caption font-normal text-content-muted">
                            held elsewhere
                          </span>
                        ) : null}
                      </p>
                      <p className="break-words text-caption text-content-muted">
                        {p.insurer ?? "insurer not recorded"}
                        {p.policyNumber ? ` · ${p.policyNumber}` : ""}
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
                        <span className="text-caption text-content-muted">no customer linked</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {money(p.sumInsured)}
                    </td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {money(p.premium)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                    </td>
                    <td className="py-3 text-caption tabular-nums text-content-muted">
                      {p.renewalDate
                        ? new Date(p.renewalDate).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "not recorded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
