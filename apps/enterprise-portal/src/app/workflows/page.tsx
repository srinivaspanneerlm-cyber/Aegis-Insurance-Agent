"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { consoleApi, type WorkflowsPayload } from "@/lib/api";

/**
 * Workflow automation.
 *
 * A viewer, not a builder — and that is the deliberate part. These definitions
 * are code, reviewed and version-controlled, because a claim approved in March
 * has to be explainable in September and a process anybody could redraw at
 * runtime has no stable answer to "which steps did this go through". A visual
 * builder would trade that away for convenience nobody has asked for.
 */
export default function WorkflowsPage() {
  const [data, setData] = useState<WorkflowsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .workflows()
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
        <h1 className="text-h1 font-bold tracking-tight text-content">Workflow Automation</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          Every process the platform runs, and where a person must decide. Definitions live in
          reviewed code rather than in editable rows, so a completed case can always be explained.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.activity.totals).map(([status, count]) => (
              <Badge key={status} tone={status === "AWAITING_HUMAN" ? "warning" : "neutral"}>
                {status} · {count}
              </Badge>
            ))}
          </div>

          {/* The one AI signal here that is a measurement rather than a claim:
              two recorded values compared. WorkflowStep.suggestion is kept even
              when a person overrode it — the schema calls it the most useful
              record the table holds — and nothing read it until now. */}
          <Panel title="Assistant suggestions at decision points">
            {data.activity.assistant.considered === 0 ? (
              <Empty icon="spark">
                No decision step has carried an assistant suggestion yet. These appear once the
                assistant offers an opinion on a case a person then decides.
              </Empty>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">{data.activity.assistant.agreed} agreed</Badge>
                  <Badge tone="warning">{data.activity.assistant.overridden} overridden</Badge>
                  {data.activity.assistant.notComparable > 0 ? (
                    <Badge>{data.activity.assistant.notComparable} not comparable</Badge>
                  ) : null}
                </div>

                <p className="mt-4 text-pretty text-caption text-content-muted">
                  Across {data.activity.assistant.considered} decision
                  {data.activity.assistant.considered === 1 ? "" : "s"} where the assistant offered
                  an opinion and a person decided.
                  {data.activity.assistant.notComparable > 0
                    ? " Suggestions written as prose rather than a decision word cannot be compared, and are counted apart rather than guessed at."
                    : ""}
                </p>

                {/* Said plainly, because the number invites the wrong reading. */}
                <p className="mt-2 text-pretty text-caption text-content-muted">
                  {data.activity.assistant.note}
                </p>
              </>
            )}
          </Panel>

          {data.catalogue.map((definition) => (
            <Panel
              key={definition.definition}
              title={definition.label}
              action={
                <span className="text-caption text-content-muted">
                  {definition.humanSteps} of {definition.totalSteps} steps are human
                </span>
              }
            >
              <ol className="flex flex-col gap-2">
                {definition.steps.map((step, index) => (
                  <li
                    key={step.key}
                    className="flex items-start gap-3 rounded-control border border-line/40 bg-surface-raised/20 px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 w-4 shrink-0 text-right text-caption tabular-nums text-content-muted"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-sm font-medium text-content">{step.name}</span>
                        <Badge
                          tone={
                            step.actorKind === "EMPLOYEE"
                              ? "success"
                              : step.actorKind === "ASSISTANT"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {step.actorKind === "EMPLOYEE"
                            ? "Person"
                            : step.actorKind === "ASSISTANT"
                              ? "Assistant"
                              : "Automatic"}
                        </Badge>
                        {step.requiresDecision ? <Badge tone="warning">Decision</Badge> : null}
                      </div>
                      <p className="mt-1 text-pretty text-caption text-content-secondary">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          ))}
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
