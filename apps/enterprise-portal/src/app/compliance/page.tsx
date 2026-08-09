"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { consoleApi } from "@/lib/api";
import { SEVERITY_TONE, type ComplianceFinding, type ComplianceSummary } from "@/lib/console";

/**
 * The compliance centre.
 *
 * Failing checks first, and each carries a remedy — a finding without a next
 * step is a complaint, not a control. The disclaimer is rendered prominently
 * rather than in small print: software asserting its own regulatory compliance
 * is the most dangerous sentence this product could print.
 */
export default function CompliancePage() {
  const [data, setData] = useState<{
    summary: ComplianceSummary;
    findings: ComplianceFinding[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .compliance()
      .then((d) => {
        if (!cancelled) setData(d);
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
        <h1 className="text-h1 font-bold tracking-tight text-content">Compliance</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          The platform&rsquo;s own checks against its own records.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <div className="rounded-card border border-line/50 bg-surface-raised/30 px-4 py-3">
            <p className="text-pretty text-body-sm text-content-secondary">
              {data.summary.disclaimer}
            </p>
          </div>

          {/* The verdict is the one field that says what to do now, and this page
              rendered every count except it. `high` was folded into a generic
              failing total, which loses the difference between a housekeeping item
              and something an audit would open with. */}
          <div
            className={
              data.summary.verdict === "ACTION_REQUIRED"
                ? "rounded-card border border-danger/40 bg-danger/10 px-4 py-3"
                : data.summary.verdict === "ATTENTION"
                  ? "rounded-card border border-warning/40 bg-warning/10 px-4 py-3"
                  : "rounded-card border border-line/50 bg-surface-raised/30 px-4 py-3"
            }
          >
            <p className="text-body-sm font-medium text-content">
              {data.summary.verdict === "ACTION_REQUIRED"
                ? `${data.summary.critical} critical finding${data.summary.critical === 1 ? "" : "s"} need attention now`
                : data.summary.verdict === "ATTENTION"
                  ? `${data.summary.high} finding${data.summary.high === 1 ? "" : "s"} to review`
                  : "Every check is passing"}
            </p>
            <p className="mt-0.5 text-caption text-content-secondary">
              {data.summary.passing} of {data.summary.checksRun} checks clear
              {data.summary.high > 0 ? ` · ${data.summary.high} high severity` : ""}
              {data.summary.critical > 0 ? ` · ${data.summary.critical} critical` : ""}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Checks run", value: data.summary.checksRun },
              { label: "Passing", value: data.summary.passing },
              { label: "Failing", value: data.summary.failing },
              { label: "Critical", value: data.summary.critical },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-card border border-line/50 bg-surface-raised/30 p-5"
              >
                <p className="text-caption font-medium uppercase tracking-wide text-content-muted">
                  {s.label}
                </p>
                <p className="mt-3 text-h1 font-bold tabular-nums text-content">{s.value}</p>
              </div>
            ))}
          </div>

          <Panel title="Findings">
            <ul className="flex flex-col gap-5">
              {data.findings.map((f) => (
                <li key={f.id} className="border-b border-line/30 pb-5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.count === 0 ? "success" : SEVERITY_TONE[f.severity]}>
                      {f.count === 0 ? "PASS" : f.severity}
                    </Badge>
                    <h2 className="text-body font-semibold text-content">{f.title}</h2>
                    {f.count > 0 ? (
                      <span className="text-caption tabular-nums text-content-muted">
                        {f.count} affected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-pretty text-body-sm text-content-secondary">{f.detail}</p>
                  {f.count > 0 ? (
                    <p className="mt-2 text-pretty text-caption text-content-muted">
                      <span className="font-medium">Remedy:</span> {f.remedy}
                    </p>
                  ) : null}

                  {/* Which records, not just how many. "3 decisions completed
                      without a person" cannot be investigated from a number. */}
                  {f.count > 0 && f.evidence && f.evidence.length > 0 ? (
                    <p className="mt-2 flex flex-wrap items-baseline gap-2 text-caption text-content-muted">
                      <span className="font-medium">Affected:</span>
                      {f.evidence.map((e) => (
                        <Link
                          key={e.id}
                          href={`/claims`}
                          className="focus-ring rounded font-medium tabular-nums text-brand"
                        >
                          {e.label}
                        </Link>
                      ))}
                      {f.count > f.evidence.length ? (
                        <span>and {f.count - f.evidence.length} more</span>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : error ? null : (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
