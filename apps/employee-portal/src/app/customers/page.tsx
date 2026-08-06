"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CoverageGapList,
  RecommendationCard,
  RiskMatrix,
  RenewalTimeline,
  NextBestAction,
  formatRupees,
  type CoverageGap,
  type IntelligenceReport,
} from "@aegis/intelligence";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { API_URL } from "@/lib/workspace";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  profileCompleteness: number;
  hasProfile: boolean;
}

/**
 * Customer intelligence, for the person about to have the conversation.
 *
 * Two panes: who to look at, and what to say. The right-hand pane renders the
 * customer's own report through the same components the customer sees it
 * through — so when they ring and say "it told me to increase my health
 * cover", the advisor is reading the identical sentence rather than a
 * staff-only paraphrase of it.
 *
 * Nothing here decides anything. The API decides what this employee may see;
 * this screen renders whatever comes back and shows a refusal plainly when it
 * does not.
 */
export default function CustomerIntelligencePage() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async (term: string) => {
    setError(null);
    try {
      const url = new URL(`${API_URL}/intelligence/customers`);
      if (term) url.searchParams.set("search", term);
      const response = await fetch(url.toString(), { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not load customers.");
      setCustomers(body.data.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers.");
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    void loadCustomers("");
  }, [loadCustomers]);

  const openCustomer = useCallback(async (customer: CustomerRow) => {
    setSelected(customer);
    setReport(null);
    setLoadingReport(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/intelligence/report?userId=${encodeURIComponent(customer.id)}`,
        { credentials: "include" }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not load that analysis.");
      setReport(body.data as IntelligenceReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that analysis.");
    } finally {
      setLoadingReport(false);
    }
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Customer Intelligence</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          The same analysis the customer sees, with the reasoning behind it.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Panel title="Customers">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadCustomers(search);
            }}
            className="mb-4 flex gap-2"
          >
            <label htmlFor="customer-search" className="sr-only">
              Search customers by name or email
            </label>
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
              className="h-9 flex-1 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="submit"
              className="focus-ring rounded-control border border-line/60 px-3 text-caption font-medium text-content"
            >
              Search
            </button>
          </form>

          {customers === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <Empty icon="users">No customers match that.</Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {customers.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => void openCustomer(customer)}
                    aria-current={selected?.id === customer.id ? "true" : undefined}
                    className={`focus-ring w-full rounded-control px-3 py-2 text-left transition-colors ${
                      selected?.id === customer.id
                        ? "bg-brand/10 text-content"
                        : "text-content-secondary hover:bg-surface-raised/50"
                    }`}
                  >
                    <span className="block text-body-sm font-medium text-content">
                      {customer.name}
                    </span>
                    <span className="block text-caption text-content-muted">{customer.email}</span>
                    <span className="mt-0.5 block text-caption text-content-muted">
                      {customer.hasProfile
                        ? `Profile ${customer.profileCompleteness}% complete`
                        : "No profile yet"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          {!selected ? (
            <Panel title="Pick a customer">
              <Empty icon="spark">
                Choose somebody on the left to see what we would tell them, and why.
              </Empty>
            </Panel>
          ) : loadingReport ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : report ? (
            <>
              <NextBestAction
                action={report.nextBestAction}
                completeness={report.profileCompleteness}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Recommendations" value={report.recommendations.length} icon="spark" />
                <Stat
                  label="Gaps found"
                  value={report.gaps.length}
                  icon="shield"
                  tone={
                    report.gaps.some((g: CoverageGap) => g.severity === "CRITICAL")
                      ? "warning"
                      : "neutral"
                  }
                />
                <Stat
                  label="Protection shortfall"
                  value={formatRupees(report.need.protectionGapValue)}
                  icon="chart"
                />
              </div>

              <Panel title="What we would suggest">
                {report.recommendations.length === 0 ? (
                  <Empty icon="check">
                    Nothing to suggest — their cover looks appropriate for what we know.
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-4">
                    {report.recommendations.map((rec, index) => (
                      <RecommendationCard
                        key={`${rec.domain}-${rec.headline}`}
                        recommendation={rec}
                        defaultExpanded={index === 0}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Gaps in their cover">
                <CoverageGapList gaps={report.gaps} />
              </Panel>

              <Panel title="Risk">
                <RiskMatrix risk={report.risk} />
              </Panel>

              <Panel title="Renewals ahead">
                <RenewalTimeline renewals={report.renewals} />
              </Panel>

              {report.documents ? (
                <Panel title="Documents">
                  <p className="text-body-sm text-content-secondary">
                    {report.documents.blocksProgress
                      ? `Waiting on ${report.documents.missing.length} document${
                          report.documents.missing.length === 1 ? "" : "s"
                        }${report.documents.rejected > 0 ? `, and ${report.documents.rejected} were not accepted` : ""}.`
                      : "Nothing outstanding."}
                  </p>
                  {report.documents.missing.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {report.documents.missing.map((doc) => (
                        <li key={doc.documentKey} className="text-body-sm text-content-secondary">
                          {doc.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Panel>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
