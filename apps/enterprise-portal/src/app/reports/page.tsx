"use client";

import { useState } from "react";

import { Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi, reportUrl } from "@/lib/api";
import type { ReportPayload } from "@/lib/console";

const REPORTS = [
  {
    kind: "operations",
    title: "Operations summary",
    description: "Customers, staff, policies, open and overdue cases, and average resolution.",
  },
  {
    kind: "compliance",
    title: "Compliance findings",
    description: "Every check, whether it passed, how many records are affected, and the remedy.",
  },
  {
    kind: "branches",
    title: "Branch comparison",
    description: "Staff, open work and overdue cases per branch.",
  },
];

/**
 * A column key as a person reads it.
 *
 * Headers come from the server's row keys, so they arrive as `openWork` rather
 * than "Open work". Splitting on the case boundary keeps the screen honest —
 * whatever columns a report grows, they are labelled with what the data
 * actually calls them rather than a hand-written list that drifts out of step.
 */
function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Rows paired with a stable key.
 *
 * Report rows carry no id — they are aggregates, not records — so the key is
 * built from the row's own values, with a counter for the case where two rows
 * are genuinely identical. A positional key would be wrong the moment a row is
 * added above another and React reused the wrong cell.
 */
function keyed(rows: Record<string, unknown>[], headers: string[]) {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = headers.map((header) => String(row[header] ?? "")).join("|");
    const previous = seen.get(base) ?? 0;
    seen.set(base, previous + 1);
    return { key: previous === 0 ? base : `${base}~${previous}`, row };
  });
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; report: ReportPayload }
  | { status: "error"; message: string };

/**
 * One report: what it contains, what it currently says, and how to take it away.
 *
 * The preview is fetched on demand rather than on mount. Three reports each
 * running their own aggregation on every visit to this page is work nobody
 * asked for, and an administrator who came here to download a CSV should not
 * pay for two reports they did not open.
 */
function ReportCard({
  kind,
  title,
  description,
}: {
  kind: string;
  title: string;
  description: string;
}) {
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const load = () => {
    if (preview) {
      setPreview(null);
      return;
    }
    setPreview({ status: "loading" });
    consoleApi
      .report(kind)
      .then((report) => setPreview({ status: "ready", report }))
      .catch((e) =>
        setPreview({
          status: "error",
          message: e instanceof Error ? e.message : "This report could not be generated.",
        })
      );
  };

  const headers =
    preview?.status === "ready" && preview.report.rows.length > 0
      ? Object.keys(preview.report.rows[0] as Record<string, unknown>)
      : [];

  return (
    <Panel title={title}>
      <p className="text-pretty text-body-sm text-content-secondary">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={reportUrl(kind, "csv")}
          className="focus-ring inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
        >
          <Icon name="book" size={16} />
          Download CSV
        </a>
        <button
          type="button"
          onClick={load}
          aria-expanded={preview !== null}
          className="focus-ring rounded-control border border-line px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
        >
          {preview ? "Hide figures" : "Show figures"}
        </button>
      </div>

      {preview?.status === "loading" ? (
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : null}

      {preview?.status === "error" ? <Empty icon="close">{preview.message}</Empty> : null}

      {preview?.status === "ready" ? (
        preview.report.rows.length === 0 ? (
          <Empty icon="book">
            This report has no rows yet — there is nothing recorded for it in this organisation.
          </Empty>
        ) : (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">{preview.report.title}</caption>
                <thead>
                  <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                    {headers.map((header) => (
                      <th key={header} scope="col" className="pb-2 pr-4 font-medium last:pr-0">
                        {humanise(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keyed(preview.report.rows, headers).map(({ key, row }) => (
                    <tr key={key} className="border-b border-line/30 last:border-0">
                      {headers.map((header) => {
                        const value = row[header];
                        return (
                          <td
                            key={header}
                            className={`py-2 pr-4 text-body-sm text-content-secondary last:pr-0 ${
                              typeof value === "number" ? "tabular-nums" : ""
                            }`}
                          >
                            {value === null || value === undefined || value === ""
                              ? "—"
                              : String(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-content-muted">
              {preview.report.rows.length} row{preview.report.rows.length === 1 ? "" : "s"} ·
              generated{" "}
              {new Date(preview.report.generatedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        )
      ) : null}
    </Panel>
  );
}

/**
 * The report centre.
 *
 * Three reports that draw on figures the platform genuinely holds. Daily,
 * weekly, monthly and yearly *cadences* are deliberately absent: the platform
 * has weeks of history, not years, and a "yearly report" over three weeks of
 * data would be a chart with one point and a misleading title.
 *
 * Downloads are plain links rather than fetch-and-blob. The browser already
 * handles a Content-Disposition correctly, including on a slow connection, and
 * reimplementing that in JavaScript only adds ways for it to fail. The figures
 * themselves are shown in the console instead of behind a raw JSON tab: an
 * administrator should be able to read a report where they stand, and see it
 * fail in plain language when it fails, rather than downloading a file to find
 * out what is in it.
 */
export default function ReportsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Enterprise Reports</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Generated live from current figures. Every generation is recorded in the audit trail.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <ReportCard
            key={report.kind}
            kind={report.kind}
            title={report.title}
            description={report.description}
          />
        ))}
      </div>

      <Panel title="What is not offered, and why">
        <p className="text-pretty text-body-sm text-content-secondary">
          Daily, weekly, monthly, quarterly and yearly cadences are not offered yet. The platform
          holds weeks of operational history rather than years, and a yearly report over that window
          would be a chart with one point and a misleading title. They arrive when the history does.
        </p>
        <p className="mt-3 text-pretty text-body-sm text-content-secondary">
          PDF and Excel export are not implemented. CSV opens in Excel and in every other
          spreadsheet, and a PDF pipeline is a dependency worth adding when somebody actually needs
          a fixed-layout document rather than figures they can work with.
        </p>
      </Panel>
    </div>
  );
}
