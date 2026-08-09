"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type IntelligencePayload } from "@/lib/api";

const KIND_LABELS: Record<string, string> = {
  RECOMMENDATION: "Recommendation",
  RISK: "Risk analysis",
  COVERAGE_GAP: "Coverage gap",
  RENEWAL: "Renewal",
};

/**
 * Customer intelligence.
 *
 * The number that matters most is the one nobody usually shows: customers with
 * no profile at all. An average completeness across the profiles that exist
 * says nothing about the people the engine cannot advise, and those are exactly
 * the ones being underserved.
 *
 * No recommendation is computed here — these are counts over what the engine
 * already produced.
 */
export default function IntelligencePage() {
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .intelligence()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load intelligence.");
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
        <h1 className="text-h1 font-bold tracking-tight text-content">Customer Intelligence</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          What the engine knows about your customers, and who it cannot reach.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Customers" value={data.customers} icon="users" />
            <Stat label="With a profile" value={data.profiles} tone="success" icon="check" />
            {/* The actionable figure. An average over existing profiles hides
                the people the engine cannot advise at all. */}
            <Stat
              label="No profile yet"
              value={data.withoutProfile}
              tone={data.withoutProfile > 0 ? "warning" : "neutral"}
              icon="close"
            />
            <Stat
              label="Average completeness"
              value={data.averageCompleteness === null ? "—" : `${data.averageCompleteness}%`}
              hint={
                data.averageCompleteness === null
                  ? "No profiles to average"
                  : "Across profiles that exist"
              }
              icon="chart"
            />
          </div>

          <p className="text-pretty text-caption text-content-muted">
            {data.adviceOutcome.reason} Needed: {data.adviceOutcome.needs}
          </p>

          {Object.keys(data.byKind).length > 0 ? (
            <Panel title={`${data.runs} analysis run${data.runs === 1 ? "" : "s"}`}>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byKind).map(([kind, count]) => (
                  <Badge key={kind}>
                    {KIND_LABELS[kind] ?? kind} · {count}
                  </Badge>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="Most recent analyses">
            {data.recent.length === 0 ? (
              <Empty icon="spark">
                The engine has not run for any of your customers yet. It runs when a customer
                completes enough of their profile to be advised.
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Customer
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Analysis
                      </th>
                      <th scope="col" className="pb-2 pr-4 font-medium">
                        Confidence
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Run
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id} className="border-b border-line/30 last:border-0">
                        <td className="py-3 pr-4">
                          {r.user ? (
                            <Link
                              href={`/customers/${r.user.id}`}
                              className="focus-ring rounded text-body-sm text-brand"
                            >
                              {r.user.name}
                            </Link>
                          ) : (
                            <span className="text-caption text-content-muted">not linked</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-body-sm text-content">
                            {KIND_LABELS[r.kind] ?? r.kind}
                          </p>
                          <p className="text-caption text-content-muted">
                            engine {r.engineVersion}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                          {/* Null is not zero confidence — it means the run
                              recorded none. */}
                          {r.confidence === null
                            ? "not recorded"
                            : `${Math.round(r.confidence * 100)}%`}
                        </td>
                        <td className="py-3 text-caption tabular-nums text-content-muted">
                          {new Date(r.createdAt).toLocaleDateString(undefined, {
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
        </>
      )}
    </div>
  );
}
