"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { consoleApi } from "@/lib/api";
import { HEALTH_TONE, type AiSystem } from "@/lib/console";

/**
 * The AI Orchestration Centre.
 *
 * Monitoring, and deliberately nothing else. There is no control on this page
 * that changes a model, a prompt or a routing rule — the customer-facing engine
 * is the hardest part of this product to reason about, and a console that let
 * somebody retune it between meetings is how it stops being reviewable.
 *
 * What administrators *may* configure is listed per system, so the boundary is
 * visible rather than merely enforced.
 */
export default function AiSystemsPage() {
  const [systems, setSystems] = useState<AiSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .aiSystems()
      .then((d) => {
        if (!cancelled) setSystems(d.systems);
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
        <h1 className="text-h1 font-bold tracking-tight text-content">AI Agents</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          Every AI system on the platform, and what it has been doing. Monitoring only — models,
          prompts and routing are changed through review, not from a console.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {systems === null && !error ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : null}

      {systems?.map((system) => (
        <Panel
          key={system.id}
          title={system.name}
          action={<Badge tone={HEALTH_TONE[system.health]}>{system.health}</Badge>}
        >
          <p className="text-pretty text-body-sm text-content-secondary">{system.purpose}</p>
          <p className="mt-1 text-caption text-content-muted">Serves: {system.audience}</p>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Activity (7d)", value: system.activity },
              { label: "In flight", value: system.workload },
              {
                label: "Success",
                value: system.successRate === null ? null : `${system.successRate}%`,
              },
              { label: "Errors", value: system.errorRate === null ? null : `${system.errorRate}%` },
            ].map((m) => (
              <div key={m.label}>
                <dt className="text-caption uppercase tracking-wide text-content-muted">
                  {m.label}
                </dt>
                <dd className="mt-1 text-body font-semibold tabular-nums text-content">
                  {m.value === null ? (
                    <span className="text-content-muted" title="Not instrumented">
                      —
                    </span>
                  ) : (
                    m.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-pretty text-caption text-content-secondary">{system.notes}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/40 pt-4">
            <Icon name="lock" size={14} className="shrink-0 text-content-muted" />
            <span className="text-caption text-content-muted">Configurable:</span>
            {system.configurable.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
