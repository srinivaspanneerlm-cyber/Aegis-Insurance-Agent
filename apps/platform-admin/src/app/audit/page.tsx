"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { platformApi, type SessionRow } from "@/lib/api";

/**
 * Live sessions across the platform.
 *
 * The platform's own audit trail is served by the enterprise console; what an
 * operator uniquely needs here is the ability to see — and during an incident,
 * end — a session anywhere on the estate.
 */
export default function SessionsPage() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .sessions()
      .then((d) => {
        if (!cancelled) setRows(d.sessions);
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
        <h1 className="text-h1 font-bold tracking-tight text-content">Live Sessions</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Everything signed in right now, across every realm.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      <Panel title={rows ? `${rows.length} live session(s)` : "Loading"}>
        {rows === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon="check">Nobody is signed in.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-content">{s.user.name}</p>
                  <p className="text-caption text-content-muted">
                    {s.user.email} · {s.ipAddress ?? "no address"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{s.realm}</Badge>
                  <span className="text-caption tabular-nums text-content-muted">
                    seen{" "}
                    {new Date(s.lastSeenAt).toLocaleTimeString(undefined, {
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

      <p className="text-pretty text-caption text-content-muted">
        The platform-wide audit trail lives in the enterprise console, which is where an
        investigation usually starts. This page is for the narrower question an operator asks during
        an incident: who is in right now.
      </p>
    </div>
  );
}
