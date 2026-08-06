"use client";

import { Panel } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { reportUrl } from "@/lib/api";

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
 * The report centre.
 *
 * Three reports that draw on figures the platform genuinely holds. Daily,
 * weekly, monthly and yearly *cadences* are deliberately absent: the platform
 * has weeks of history, not years, and a "yearly report" over three weeks of
 * data would be a chart with one point and a misleading title.
 *
 * Downloads are plain links rather than fetch-and-blob. The browser already
 * handles a Content-Disposition correctly, including on a slow connection, and
 * reimplementing that in JavaScript only adds ways for it to fail.
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
          <Panel key={report.kind} title={report.title}>
            <p className="text-pretty text-body-sm text-content-secondary">{report.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={reportUrl(report.kind, "csv")}
                className="focus-ring inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
              >
                <Icon name="book" size={16} />
                Download CSV
              </a>
              <a
                href={reportUrl(report.kind)}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded-control border border-line px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
              >
                View as data
              </a>
            </div>
          </Panel>
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
