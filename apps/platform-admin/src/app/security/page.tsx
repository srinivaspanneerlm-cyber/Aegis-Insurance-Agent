"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton, Stat } from "@/components/Cards";
import { platformApi, type SecurityPayload } from "@/lib/api";

/** Security: failed sign-ins, permission denials and locked accounts. */
export default function SecurityPage() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .security()
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

  if (error) return <Empty icon="close">{error}</Empty>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Security Center</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Sign-in failures, authorisation refusals and accounts currently locked.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Failed sign-ins today"
          value={data.failedLoginsToday}
          tone={data.failedLoginsToday > 20 ? "danger" : "neutral"}
          icon="lock"
        />
        <Stat label="This week" value={data.failedLoginsThisWeek} icon="chart" />
        <Stat
          label="Permission denials today"
          value={data.permissionDenialsToday}
          tone={data.permissionDenialsToday > 0 ? "warning" : "neutral"}
          icon="shield"
        />
        <Stat
          label="Locked now"
          value={data.accountsLockedNow}
          tone={data.accountsLockedNow > 0 ? "warning" : "success"}
          icon="clock"
        />
      </div>

      <Panel title="Sign-in outcomes, last 7 days">
        {Object.keys(data.outcomes).length === 0 ? (
          <Empty>No sign-in activity.</Empty>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(data.outcomes).map(([outcome, count]) => (
              <li key={outcome}>
                <Badge tone={outcome === "SUCCESS" ? "success" : "warning"}>
                  {outcome} · {count}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent failures">
        {data.recentFailures.length === 0 ? (
          <Empty icon="check">Nothing recently.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recentFailures.slice(0, 20).map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line/30 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-body-sm text-content">{f.email || "(no address given)"}</span>
                <div className="flex items-center gap-2">
                  <Badge tone="warning">{f.outcome}</Badge>
                  <span className="text-caption tabular-nums text-content-muted">
                    {f.ipAddress ?? "—"} ·{" "}
                    {new Date(f.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Authorisation refusals">
        {data.permissionDenials.length === 0 ? (
          <Empty icon="check">Nobody has been refused.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.permissionDenials.slice(0, 20).map((d) => (
              <li key={d.id} className="border-b border-line/30 pb-2 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{d.action}</Badge>
                  <span className="text-caption tabular-nums text-content-muted">
                    {new Date(d.createdAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {d.metadata ? (
                  <pre className="mt-1 overflow-x-auto rounded-control bg-surface-raised/40 p-2 text-caption text-content-secondary">
                    {d.metadata}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Locked accounts">
        {data.lockedAccounts.length === 0 ? (
          <Empty icon="check">None.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.lockedAccounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="text-body-sm text-content">{a.email}</span>
                <span className="text-caption text-content-muted">
                  {a.failedLoginAttempts} attempt(s) · until{" "}
                  {new Date(a.lockedUntil).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-pretty text-caption text-content-muted">
          Locks expire on their own. There is no unlock button, because a lockout is itself a
          denial-of-service vector — anybody who knows an address can trigger one, and a manual
          unlock would make that worth doing.
        </p>
      </Panel>
    </div>
  );
}
