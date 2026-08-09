"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { MetricCard } from "@/components/MetricCard";
import { consoleApi, type CustomerDetail } from "@/lib/api";

const KIND_LABELS: Record<string, string> = {
  CLAIM: "Claim",
  KYC: "KYC",
  RENEWAL: "Renewal",
  COMPLAINT: "Complaint",
  APPOINTMENT: "Appointment",
  TASK: "Task",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  AWAITING_CUSTOMER: "Awaiting customer",
  AWAITING_APPROVAL: "Awaiting approval",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/**
 * One customer, as an administrator may see them.
 *
 * The list has always linked nowhere while this endpoint sat unused. What it
 * returns is the operational record — what is open, how much they have lodged,
 * how they have been signing in — and deliberately no conversation content: an
 * administrator has a legitimate need to see that a customer exists and what is
 * open for them, and none at all to read what they told an advisor in
 * confidence. The boundary is kept by the server never selecting the column.
 */
export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .customer(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this customer.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { customer, work, documents, logins } = data;
  const open = work.filter((w) => !w.resolvedAt).length;
  const failedLogins = logins.filter((l) => l.outcome !== "SUCCESS").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <Link href="/customers" className="focus-ring rounded text-caption font-medium text-brand">
          ← All customers
        </Link>
        <h1 className="mt-2 text-h1 font-bold tracking-tight text-content">{customer.name}</h1>
        <p className="mt-1 break-words text-body-sm text-content-secondary">{customer.email}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={customer.isActive ? "success" : "danger"}>
            {customer.isActive ? "Active" : "Deactivated"}
          </Badge>
          {!customer.emailVerifiedAt ? <Badge tone="warning">Email unverified</Badge> : null}
          {!customer.onboardedAt ? <Badge>Onboarding incomplete</Badge> : null}
          {customer.preferredLanguage ? <Badge>{customer.preferredLanguage}</Badge> : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Open cases"
          metric={{ available: true, value: open }}
          icon="layers"
          render={(v) => ({ value: v, hint: `${work.length} in total` })}
        />
        <MetricCard
          label="Documents"
          metric={{ available: true, value: documents }}
          icon="book"
          render={(v) => ({ value: v, hint: "Held on file" })}
        />
        <MetricCard
          label="Customer since"
          metric={{ available: true, value: customer.createdAt }}
          icon="clock"
          render={(v) => ({
            value: new Date(v).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
          })}
        />
        <MetricCard
          label="Failed sign-ins"
          metric={{ available: true, value: failedLogins }}
          icon="shield"
          tone={failedLogins > 0 ? "warning" : "neutral"}
          render={(v) => ({ value: v, hint: "In the last 10 attempts" })}
        />
      </div>

      <Panel title="Their cases">
        {work.length === 0 ? (
          <Empty icon="check">Nothing has ever been opened for this customer.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Work
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Opened
                  </th>
                </tr>
              </thead>
              <tbody>
                {work.map((w) => (
                  <tr key={w.id} className="border-b border-line/30 last:border-0">
                    <td className="py-2.5 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {w.reference}
                    </td>
                    <td className="py-2.5 pr-4">
                      <p className="text-body-sm text-content">{w.title}</p>
                      <p className="text-caption text-content-muted">
                        {KIND_LABELS[w.kind] ?? w.kind}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={w.resolvedAt ? "success" : "neutral"}>
                        {STATUS_LABELS[w.status] ?? w.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-caption tabular-nums text-content-muted">
                      {new Date(w.openedAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent sign-ins">
        {logins.length === 0 ? (
          <Empty>This customer has never signed in.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {logins.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-3 border-b border-line/30 pb-2 last:border-0 last:pb-0"
              >
                <Badge tone={l.outcome === "SUCCESS" ? "success" : "danger"}>{l.outcome}</Badge>
                <span className="text-caption text-content-secondary">
                  {l.method ?? "password"}
                </span>
                {/* An address is shown because a run of failures from one place
                    is the thing worth noticing here. */}
                <span className="text-caption tabular-nums text-content-muted">
                  {l.ipAddress ?? "address not recorded"}
                </span>
                <time
                  dateTime={l.createdAt}
                  className="ml-auto text-caption tabular-nums text-content-muted"
                >
                  {new Date(l.createdAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-pretty text-caption text-content-muted">
        Conversations with advisors are not shown here and are not available to this console.
      </p>
    </div>
  );
}
