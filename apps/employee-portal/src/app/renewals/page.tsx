"use client";

import { useEffect, useState } from "react";
import { Panel, Skeleton, Stat } from "@/components/Cards";
import { QueuePage } from "@/components/QueuePage";
import { workspaceApi, type RenewalAnalytics } from "@/lib/api";

const KINDS = ["RENEWAL"];

/**
 * Renewals.
 *
 * Two views, and the distinction matters. The queue below shows renewals
 * *assigned to you* — work somebody has already raised. The figures above show
 * renewals across the book, from the Sprint 9 engine.
 *
 * A customer whose cover expires next week with no work item raised appears in
 * the second and not the first, and those are precisely the ones that lapse. A
 * queue alone cannot show you what nobody has noticed yet.
 */
export default function RenewalsPage() {
  const [book, setBook] = useState<RenewalAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .renewalAnalytics()
      .then((data) => {
        if (!cancelled) setBook(data);
      })
      .catch(() => {
        // The queue below is still useful; a failed overview must not take it.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Panel title="Across the book">
        {failed ? (
          <p className="text-body-sm text-content-secondary">
            The renewal overview could not be loaded. Your assigned queue is below.
          </p>
        ) : book === null ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Overdue"
                value={book.overdue}
                tone={book.overdue > 0 ? "danger" : "success"}
                hint={book.overdue > 0 ? "Renewal date has passed" : "Nothing past its date"}
                icon="clock"
              />
              <Stat
                label="Within 7 days"
                value={book.buckets.within7}
                tone={book.buckets.within7 > 0 ? "warning" : "neutral"}
                icon="refresh"
              />
              <Stat label="Within 90 days" value={book.upcoming90Days} icon="chart" />
              <Stat label="Active policies" value={book.activePolicies} icon="shield" />
            </div>

            <p className="mt-4 text-pretty text-caption text-content-muted">
              {/* The note names what the figure excludes. A premium total that
                  silently skipped policies without one recorded would read as
                  the whole book. */}
              Premium at risk in the next 90 days: ₹{book.premiumAtRisk.toLocaleString("en-IN")}.{" "}
              {book.premiumAtRiskNote}
            </p>

            {!book.renewalRate.available ? (
              <p className="mt-2 text-pretty text-caption text-content-muted">
                We cannot yet tell you how many of these actually renew: {book.renewalRate.reason}
              </p>
            ) : null}
          </>
        )}
      </Panel>

      <QueuePage
        title="Assigned to you"
        description="Renewals somebody has raised as work. The figures above cover the whole book."
        kinds={KINDS}
        emptyMessage="No renewals are assigned to you."
      />
    </div>
  );
}
