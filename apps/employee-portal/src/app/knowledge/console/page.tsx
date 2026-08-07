"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KnowledgeCard,
  KnowledgeError,
  useAnalytics,
  useArticles,
  emptyFilters,
  type ArticleFilters,
  type KnowledgeArticle,
} from "@aegis/knowledge";
import { Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { knowledgeClient } from "@/lib/knowledgeClient";

/**
 * The knowledge console: review, approve, withdraw.
 *
 * The review queue leads, because it is the only thing here that somebody else
 * is waiting on. Analytics sit below it — a knowledge manager opening this page
 * with three articles pending does not need a chart first.
 *
 * A rejection needs a reason and the form enforces it before the request goes
 * out, so an author gets told what to change rather than a 400.
 */
export default function KnowledgeConsolePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<ArticleFilters>({ ...emptyFilters, status: "IN_REVIEW" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const queue = useArticles(knowledgeClient, filters, 20);
  const analytics = useAnalytics(knowledgeClient);

  const act = useCallback(
    async (id: string, run: () => Promise<unknown>) => {
      setBusy(id);
      setError(null);
      try {
        await run();
        setRejecting(null);
        setReason("");
        queue.reload();
      } catch (err) {
        setError(err instanceof KnowledgeError ? err.message : "That did not go through.");
      } finally {
        setBusy(null);
      }
    },
    [queue]
  );

  const stats = analytics.data as
    | {
        totals?: { byStatus?: Record<string, number>; indexedForSearch?: number };
        needsAttention?: {
          overdueForReview?: KnowledgeArticle[];
          expiringWithin30Days?: Array<{ id: string; title: string; effectiveTo: string }>;
          approvedButNeverRead?: number;
        };
        searchEffectiveness?: { available: boolean; reason?: string; needs?: string };
      }
    | undefined;

  const byStatus = stats?.totals?.byStatus ?? {};
  const overdue = stats?.needsAttention?.overdueForReview ?? [];
  const expiring = stats?.needsAttention?.expiringWithin30Days ?? [];

  const tabs: Array<{ label: string; status: string }> = useMemo(
    () => [
      { label: "Waiting for review", status: "IN_REVIEW" },
      { label: "Drafts", status: "DRAFT" },
      { label: "Published", status: "APPROVED" },
      { label: "Withdrawn", status: "ARCHIVED" },
    ],
    []
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-content">Knowledge console</h1>
          <p className="mt-1 text-body-sm text-content-secondary">
            Review what is waiting, and withdraw what is no longer true.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/knowledge/new")}
          className="focus-ring rounded-control bg-brand px-4 py-2 text-caption font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
        >
          Write guidance
        </button>
      </header>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Waiting"
          value={byStatus.IN_REVIEW ?? 0}
          icon="clock"
          tone={(byStatus.IN_REVIEW ?? 0) > 0 ? "warning" : "neutral"}
        />
        <Stat label="Published" value={byStatus.APPROVED ?? 0} icon="check" />
        <Stat
          label="Overdue for review"
          value={overdue.length}
          icon="shield"
          tone={overdue.length > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Never opened"
          value={stats?.needsAttention?.approvedButNeverRead ?? 0}
          icon="chart"
        />
      </div>

      <Panel title="The queue">
        <div role="tablist" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.status}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.status}
              onClick={() => setFilters({ ...filters, status: tab.status })}
              className={`focus-ring rounded-control px-3 py-1.5 text-caption font-medium transition-colors ${
                filters.status === tab.status
                  ? "bg-brand/10 text-content"
                  : "border border-line/60 text-content-secondary hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {queue.loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : queue.items.length === 0 ? (
          <Empty icon="check">Nothing here.</Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {queue.items.map((article) => (
              <li key={article.id} className="flex flex-col gap-2">
                <KnowledgeCard
                  article={article}
                  onOpen={() => router.push(`/knowledge/a/${article.slug}`)}
                />

                {rejecting === article.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act(article.id, () =>
                        knowledgeClient.review(article.id, "CHANGES_REQUESTED", reason)
                      );
                    }}
                    className="flex flex-col gap-2 pl-1"
                  >
                    <label htmlFor={`reason-${article.id}`} className="text-caption text-content">
                      What needs changing? The author sees this.
                    </label>
                    <input
                      id={`reason-${article.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      placeholder="The cashless section is out of date since the 2026 circular."
                      className="h-9 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busy === article.id}
                        className="focus-ring rounded-control bg-warning px-3 py-1.5 text-caption font-semibold text-status-fg disabled:opacity-50"
                      >
                        Send back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(null);
                          setReason("");
                        }}
                        className="focus-ring rounded-control border border-line px-3 py-1.5 text-caption font-medium text-content"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {article.status === "IN_REVIEW" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === article.id}
                          onClick={() =>
                            void act(article.id, () =>
                              knowledgeClient.review(article.id, "APPROVED")
                            )
                          }
                          className="focus-ring rounded-control bg-brand px-3 py-1.5 text-caption font-semibold text-brand-fg disabled:opacity-50"
                        >
                          {busy === article.id ? "Saving…" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(article.id)}
                          className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content-secondary"
                        >
                          Send back
                        </button>
                      </>
                    ) : null}

                    {article.status === "DRAFT" ? (
                      <button
                        type="button"
                        disabled={busy === article.id}
                        onClick={() =>
                          void act(article.id, () => knowledgeClient.submit(article.id))
                        }
                        className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content"
                      >
                        Send for review
                      </button>
                    ) : null}

                    {article.status === "APPROVED" ? (
                      <button
                        type="button"
                        disabled={busy === article.id}
                        onClick={() => {
                          const why = window.prompt("Why is this being withdrawn?");
                          if (why?.trim()) {
                            void act(article.id, () =>
                              knowledgeClient.archive(article.id, why.trim())
                            );
                          }
                        }}
                        className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-danger"
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Needs attention">
          {overdue.length === 0 && expiring.length === 0 ? (
            <Empty icon="check">Nothing is overdue or expiring.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {overdue.length > 0 ? (
                <section>
                  <h3 className="mb-1.5 text-caption font-semibold uppercase text-content-muted">
                    Overdue for review
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {overdue.map((a) => (
                      <li key={a.id} className="text-body-sm text-content-secondary">
                        {a.title}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {expiring.length > 0 ? (
                <section>
                  <h3 className="mb-1.5 text-caption font-semibold uppercase text-content-muted">
                    Stops applying within 30 days
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {expiring.map((a) => (
                      <li key={a.id} className="text-body-sm text-content-secondary">
                        {a.title}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Search">
          <p className="text-body-sm text-content-secondary">
            {stats?.totals?.indexedForSearch ?? 0} articles are indexed.
          </p>
          {stats?.searchEffectiveness && !stats.searchEffectiveness.available ? (
            // The backend declares this unavailable rather than inventing it;
            // the console repeats that plainly instead of drawing an empty chart.
            <p className="mt-2 text-pretty text-caption text-content-muted">
              We cannot yet tell you whether search is helping people.{" "}
              {stats.searchEffectiveness.reason}
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
