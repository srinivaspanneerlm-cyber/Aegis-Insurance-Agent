"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { consoleApi, type SecurityPayload } from "@/lib/api";

/**
 * Security: how your people have been signing in.
 *
 * The endpoint has been live and unread since this console was built. Failed
 * attempts are the figure worth watching — a run of them from one address is
 * the thing this screen exists to make visible.
 *
 * Scoped to your organisation: the events belong to whoever signed in.
 */
export default function SecurityPage() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .securityEvents()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load security events.");
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

  const failed = data
    ? Object.entries(data.byOutcome)
        .filter(([o]) => o !== "SUCCESS")
        .reduce((a, [, n]) => a + n, 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Security</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Sign-in activity for your people.
        </p>
      </header>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Successful"
              value={data.byOutcome.SUCCESS ?? 0}
              tone="success"
              icon="check"
            />
            <Stat
              label="Failed"
              value={failed}
              tone={failed > 0 ? "warning" : "neutral"}
              icon="shield"
            />
            <Stat label="Events recorded" value={data.recent.length} icon="layers" />
          </div>

          <Panel title="Most recent sign-in attempts">
            {data.recent.length === 0 ? (
              <Empty icon="check">
                No sign-in activity has been recorded for your organisation.
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.recent.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-3 border-b border-line/30 pb-2 last:border-0 last:pb-0"
                  >
                    <Badge tone={e.outcome === "SUCCESS" ? "success" : "danger"}>{e.outcome}</Badge>
                    <span className="text-caption text-content-secondary">
                      {e.method ?? "password"}
                    </span>
                    {/* The address is what turns a list of failures into a
                        pattern somebody can act on. */}
                    <span className="text-caption tabular-nums text-content-muted">
                      {e.ipAddress ?? "address not recorded"}
                    </span>
                    <time
                      dateTime={e.createdAt}
                      className="ml-auto text-caption tabular-nums text-content-muted"
                    >
                      {new Date(e.createdAt).toLocaleString(undefined, {
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
        </>
      )}
    </div>
  );
}
