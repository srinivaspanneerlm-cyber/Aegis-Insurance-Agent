"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { platformApi, type AiGovernancePayload } from "@/lib/api";
import { HEALTH_TONE } from "@/lib/platform";

/**
 * AI governance.
 *
 * The console where somebody would most expect to be able to change a model,
 * and the one place it is most important they cannot. What is shown is what is
 * running and what it has done; what is missing is declared with the record
 * that would have to start being written.
 */
export default function AiGovernancePage() {
  const [data, setData] = useState<AiGovernancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .aiGovernance()
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
        <h1 className="text-h1 font-bold tracking-tight text-content">AI Governance</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          Every AI system on the platform, what it has been doing, and what the platform does not
          yet know about it.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <div className="flex items-start gap-3 rounded-card border border-brand/30 bg-brand/5 px-4 py-3">
            <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-pretty text-body-sm text-content-secondary">{data.changeControl}</p>
          </div>

          {data.systems.map((s) => (
            <Panel
              key={s.id}
              title={s.name}
              action={
                <Badge tone={HEALTH_TONE[s.health as keyof typeof HEALTH_TONE] ?? "neutral"}>
                  {s.health}
                </Badge>
              }
            >
              <p className="text-pretty text-body-sm text-content-secondary">{s.purpose}</p>
              <p className="mt-1 text-caption text-content-muted">Serves: {s.audience}</p>

              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Activity (7d)", s.activity],
                  ["In flight", s.workload],
                  ["Version", s.governance.version],
                  ["Token usage", s.governance.tokenUsage],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-caption uppercase tracking-wide text-content-muted">
                      {label as string}
                    </dt>
                    <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                      {value === null || value === undefined ? (
                        <span className="text-content-muted" title="Not instrumented">
                          —
                        </span>
                      ) : (
                        (value as number)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 text-pretty text-caption text-content-secondary">{s.notes}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/40 pt-4">
                <span className="text-caption text-content-muted">Configurable:</span>
                {s.configurable.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            </Panel>
          ))}

          <Panel title="What governance cannot see yet">
            <ul className="flex flex-col gap-3">
              {data.notInstrumented.map((n) => (
                <li key={n.field} className="border-b border-line/30 pb-3 last:border-0 last:pb-0">
                  <p className="text-body-sm font-medium text-content">{n.field}</p>
                  <p className="mt-1 text-pretty text-caption text-content-secondary">{n.reason}</p>
                  <p className="mt-1 text-pretty text-caption text-content-muted">
                    <span className="font-medium">Needs:</span> {n.needs}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : error ? null : (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
