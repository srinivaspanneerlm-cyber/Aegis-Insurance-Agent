"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi, type AuditEntry } from "@/lib/api";

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
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: string) => {
    setData(null);
    setError(null);
    try {
      setData(await consoleApi.audit(action));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("action") ?? "";
    setTerm(initial);
    void run(initial);
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
          void run(term);
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
          {data.actions.length > 0 ? (
            <Panel title="Most frequent events">
              <ul className="flex flex-wrap gap-2">
                {data.actions.map((a) => (
                  <li key={a.action}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerm(a.action);
                        void run(a.action);
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
                      <span className="text-caption tabular-nums text-content-muted">
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.metadata ? (
                      <pre className="mt-2 overflow-x-auto rounded-control bg-surface-raised/40 p-2 text-caption text-content-secondary">
                        {entry.metadata}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
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
