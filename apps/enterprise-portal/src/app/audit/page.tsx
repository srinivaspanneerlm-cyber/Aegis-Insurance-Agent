"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, ShowMore, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi, MAX_ROWS, type AuditEntry } from "@/lib/api";

/**
 * The audit centre.
 *
 * The header's enterprise search posts here with `?action=`, so a query typed
 * anywhere in the console lands already run. The trail is append-only and the
 * console offers no way to edit or delete an entry — an audit log a
 * sufficiently-privileged person can rewrite is not an audit log.
 */
export default function AuditPage() {
  const [term, setTerm] = useState("");
  const [data, setData] = useState<{
    total: number;
    entries: AuditEntry[];
    actions: { action: string; count: number }[];
    actors: { id: string; name: string; count: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Everything this person did" was unanswerable: the endpoint took an
  // actorId and nothing sent one.
  const [actorId, setActorId] = useState<string | null>(null);

  const [expanding, setExpanding] = useState(false);
  // The action the table is showing, which is not necessarily what is in the
  // box — asking for more rows must not silently run a half-typed query.
  const [applied, setApplied] = useState("");

  const run = useCallback(async (action: string, actor?: string | null, take?: number) => {
    if (take === undefined) {
      setData(null);
      setApplied(action);
    }
    setError(null);
    try {
      setData(await consoleApi.audit(action, actor ?? undefined, take));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("action") ?? "";
    setTerm(initial);
    void run(initial, null);
  }, [run]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Audit Logs</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Every recorded event: sign-ins, role changes, approvals, configuration and security.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Carry the selected person through the search. Dropping them here
          // unfiltered the results while their chip stayed lit and the note
          // still read "showing one person's actions".
          void run(term, actorId);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <label htmlFor="audit-search" className="sr-only">
            Filter by action
          </label>
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            id="audit-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="auth.login, workflow.step, admin.report…"
            className="h-11 w-full rounded-control border border-line/60 bg-surface-raised/40 pl-9 pr-3 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <button
          type="submit"
          className="focus-ring h-11 rounded-control bg-brand px-5 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
        >
          Search
        </button>
      </form>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          {/* Who has been acting. The endpoint has always taken an actorId and
              nothing sent one, so "everything this person did" — the first
              question asked of an audit trail — was unanswerable. */}
          {data.actors.length > 0 ? (
            <Panel title="Who has been acting">
              <ul className="flex flex-wrap gap-2">
                {data.actors.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = actorId === a.id ? null : a.id;
                        setActorId(next);
                        void run(term, next);
                      }}
                      aria-pressed={actorId === a.id}
                      className={
                        actorId === a.id
                          ? "focus-ring rounded-pill border border-brand/40 bg-brand/10 px-3 py-1 text-caption font-medium text-content"
                          : "focus-ring rounded-pill border border-line/60 px-3 py-1 text-caption text-content-secondary transition-colors hover:border-line hover:text-content"
                      }
                    >
                      {a.name} · {a.count}
                    </button>
                  </li>
                ))}
              </ul>
              {actorId ? (
                <p className="mt-3 text-caption text-content-muted">
                  Showing one person&rsquo;s actions. Click their name again to see everyone.
                </p>
              ) : null}
            </Panel>
          ) : null}

          {data.actions.length > 0 ? (
            <Panel title="Most frequent events">
              <ul className="flex flex-wrap gap-2">
                {data.actions.map((a) => (
                  <li key={a.action}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerm(a.action);
                        void run(a.action, actorId);
                      }}
                      className="focus-ring rounded-pill border border-line/60 px-3 py-1 text-caption text-content-secondary transition-colors hover:border-line hover:text-content"
                    >
                      {a.action} <span className="tabular-nums text-content-muted">{a.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title={`${data.entries.length} of ${data.total} event(s)`}>
            {data.entries.length === 0 ? (
              <Empty icon="search">Nothing matched that action.</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-line/30 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          entry.action.startsWith("authz.") || entry.action.includes("denied")
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {entry.action}
                      </Badge>
                      {/* Who. The trail stored an id and the console showed
                          neither, so a record said what happened and not who
                          did it. */}
                      <span className="text-body-sm text-content">{entry.actorName}</span>
                      {/* What was acted on. entity and entityId were in every
                          payload and rendered nowhere. */}
                      {entry.entity ? (
                        <span className="text-caption text-content-secondary">
                          on {entry.entity}
                          {entry.entityId ? (
                            <span className="tabular-nums text-content-muted">
                              {" "}
                              {entry.entityId.slice(0, 8)}…
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="ml-auto text-caption tabular-nums text-content-muted">
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.actorEmail || entry.ipAddress ? (
                      <p className="mt-0.5 break-words text-caption text-content-muted">
                        {entry.actorEmail ?? ""}
                        {entry.actorEmail && entry.ipAddress ? " · " : ""}
                        {entry.ipAddress ?? ""}
                      </p>
                    ) : null}
                    {entry.metadata ? (
                      <pre className="mt-2 overflow-x-auto rounded-control bg-surface-raised/40 p-2 text-caption text-content-secondary">
                        {entry.metadata}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <ShowMore
              shown={data.entries.length}
              total={data.total}
              max={MAX_ROWS}
              busy={expanding}
              noun="events"
              onMore={() => {
                setExpanding(true);
                void run(applied, actorId, MAX_ROWS).finally(() => setExpanding(false));
              }}
            />
          </Panel>
        </>
      ) : error ? null : (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
