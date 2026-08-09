"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import {
  API_URL,
  KIND_LABELS,
  STATUS_LABELS,
  raisedByAssistant,
  type WorkItem,
} from "@/lib/workspace";
import { WorkspaceError } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceProvider";

interface Step {
  id: string;
  key: string;
  name: string;
  order: number;
  status: string;
  actorKind: string | null;
  decision: string | null;
  notes: string | null;
  suggestion: string | null;
  completedAt: string | null;
}

interface TimelineEvent {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  /** Null when the platform acted rather than a person. */
  actorId: string | null;
  /** A JSON blob — the routing decision, the permission checked, and so on. */
  detail: string | null;
}

/** Event kinds, in words. The raw values are database enums. */
const EVENT_LABELS: Record<string, string> = {
  OPENED: "Opened",
  ASSIGNED: "Assigned",
  STATUS_CHANGED: "Status changed",
  STEP_COMPLETED: "Step completed",
  NOTE: "Note added",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CONTACTED: "Customer contacted",
  REOPENED: "Reopened",
};

const EVENT_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  OPENED: "info",
  RESOLVED: "success",
  ESCALATED: "danger",
};

/**
 * Who did it, as precisely as this realm can say.
 *
 * The endpoint sends `actorId` and no name, and resolving one would need a
 * lookup this portal has no route for. So the answer is the platform, you, or
 * somebody else — naming the colleague would mean inventing it.
 */
function actorLabel(actorId: string | null, meId: string | undefined): string {
  if (!actorId) return "By the platform";
  if (meId && actorId === meId) return "By you";
  return "By another member of staff";
}

/** Formats the recorded detail blob, or gives up honestly. */
function formatDetail(detail: string): string {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    // Not JSON after all. Showing it raw beats showing nothing on an audit
    // trail — the record is the point.
    return detail;
  }
}

interface WorkDetail {
  item: WorkItem;
  run: { id: string; definition: string; currentStep: string | null; status: string } | null;
  steps: Step[];
  timeline: TimelineEvent[];
}

const DECISIONS = [
  { value: "APPROVE", label: "Approve", tone: "success" as const },
  { value: "REQUEST_INFO", label: "Request more information", tone: "info" as const },
  { value: "ESCALATE", label: "Escalate", tone: "warning" as const },
  { value: "REJECT", label: "Reject", tone: "danger" as const },
];

/**
 * One case, with its process and its history.
 *
 * The whole workflow is shown — including the steps not reached yet — because
 * the person most likely to open this screen is somebody picking the case up
 * from a colleague, and "what happens next" is the first thing they need.
 */
export default function WorkItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session } = useWorkspace();
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/employee/work/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new WorkspaceError(body.message ?? "Not found.", response.status, body.code ?? "");
      setDetail(body.data as WorkDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this case.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = useCallback(
    async (stepKey: string, decision?: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const response = await fetch(`${API_URL}/employee/work/${encodeURIComponent(id)}/advance`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepKey, ...(decision ? { decision } : {}) }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "That did not go through.");
        await load();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(false);
      }
    },
    [id, load]
  );

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Empty icon="close">{error}</Empty>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { item, run, steps, timeline } = detail;
  const currentStep = run?.currentStep ? steps.find((s) => s.key === run.currentStep) : null;
  const isMine = Boolean(currentStep && currentStep.actorKind !== "SYSTEM");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-caption tabular-nums text-content-muted">{item.reference}</p>
          <h1 className="mt-1 text-h1 font-bold tracking-tight text-content">{item.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{KIND_LABELS[item.kind] ?? item.kind}</Badge>
            <Badge>{STATUS_LABELS[item.status] ?? item.status}</Badge>
            <Badge tone={item.priority === "URGENT" ? "danger" : "neutral"}>{item.priority}</Badge>
          </div>
        </div>
      </header>

      {item.summary ? (
        <p className="max-w-3xl text-pretty text-body-sm text-content-secondary">{item.summary}</p>
      ) : null}

      {/* Where the case came from.

          `origin` and `originRationale` have been on this record since the work
          system was built and no screen read them, so a case the assistant
          raised was indistinguishable from one a colleague raised. That matters
          most at the point of deciding: the reason is a model's inference, and
          somebody weighing it is entitled to know that before they act on it. */}
      {raisedByAssistant(item) ? (
        <div className="flex max-w-3xl items-start gap-3 rounded-card border border-brand/30 bg-brand/5 px-4 py-3">
          <Icon name="spark" size={18} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-content">The assistant raised this.</p>
            <p className="mt-1 text-pretty text-body-sm text-content-secondary">
              {item.originRationale ??
                "No reason was recorded with it. Treat it as a prompt to look, not as a finding."}
            </p>
            <p className="mt-2 text-caption text-content-muted">
              It is a suggestion. Closing it is your call, and your decision is what gets recorded.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Process" className="lg:col-span-2">
          {!run ? (
            <Empty>This work has no formal process attached.</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {steps.map((step) => {
                const current = run.currentStep === step.key;
                return (
                  <li
                    key={step.id}
                    className={
                      current
                        ? "rounded-control border border-brand/40 bg-brand/5 px-4 py-3"
                        : "rounded-control border border-line/40 px-4 py-3"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StepMark status={step.status} />
                      <span className="text-body-sm font-medium text-content">{step.name}</span>
                      {step.decision ? <Badge tone="info">{step.decision}</Badge> : null}
                      {current ? <Badge tone="warning">Current</Badge> : null}
                    </div>
                    {step.notes ? (
                      <p className="mt-2 text-caption text-content-secondary">{step.notes}</p>
                    ) : null}
                    {step.suggestion ? (
                      <p className="mt-2 text-caption text-content-muted">
                        Assistant suggested: {step.suggestion}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          {actionError ? (
            <p
              role="alert"
              className="mt-4 rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger"
            >
              {actionError}
            </p>
          ) : null}

          {currentStep && isMine && run?.status !== "COMPLETED" && run?.status !== "REJECTED" ? (
            <div className="mt-5 border-t border-line/50 pt-5">
              <h3 className="text-body-sm font-semibold text-content">
                {currentStep.name} — your move
              </h3>
              {currentStep.actorKind === "EMPLOYEE" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {DECISIONS.map((decision) => (
                    <button
                      key={decision.value}
                      type="button"
                      disabled={busy}
                      onClick={() => void advance(currentStep.key, decision.value)}
                      className="focus-ring rounded-control border border-line bg-surface-raised px-4 py-2 text-body-sm font-medium text-content transition-colors hover:border-line-strong disabled:opacity-50"
                    >
                      {decision.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void advance(currentStep.key)}
                  className="focus-ring mt-3 rounded-control bg-brand px-5 py-2 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  {busy ? "Working…" : "Mark complete"}
                </button>
              )}
            </div>
          ) : null}
        </Panel>

        <Panel title="History">
          {timeline.length === 0 ? (
            <Empty>Nothing has happened yet.</Empty>
          ) : (
            <ol className="flex flex-col gap-4">
              {timeline.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line"
                  />
                  <div className="min-w-0 flex-1">
                    {/* kind, actorId and detail were all in the payload and none
                        was rendered. On an audit trail, what happened and who
                        did it are the two things that matter most. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={EVENT_TONE[event.kind] ?? "neutral"}>
                        {EVENT_LABELS[event.kind] ?? event.kind}
                      </Badge>
                      <time
                        dateTime={event.createdAt}
                        className="text-caption tabular-nums text-content-muted"
                      >
                        {new Date(event.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>

                    <p className="mt-1 text-pretty text-body-sm text-content-secondary">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-caption text-content-muted">
                      {actorLabel(event.actorId, session?.user.id)}
                    </p>

                    {event.detail ? (
                      <details className="mt-2">
                        <summary className="focus-ring cursor-pointer rounded text-caption text-brand">
                          What was recorded
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-control border border-line/40 bg-surface-raised/30 p-3 text-caption text-content-secondary">
                          {formatDetail(event.detail)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** The mark carries the state in shape as well as colour. */
function StepMark({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return <Icon name="check" size={16} className="shrink-0 text-success" />;
  }
  if (status === "REJECTED") {
    return <Icon name="close" size={16} className="shrink-0 text-danger" />;
  }
  if (status === "IN_PROGRESS") {
    return <Icon name="bolt" size={16} className="shrink-0 text-brand" />;
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
    />
  );
}
