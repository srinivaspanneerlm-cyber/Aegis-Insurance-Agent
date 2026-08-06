"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { Icon } from "@/components/Icon";
import { workspaceApi, type WorkflowDefinitionView } from "@/lib/api";

/**
 * The employee assistant.
 *
 * What is real here, stated plainly because the alternative is a demo that
 * lies: the assistant's **place in the work** is built and enforced. It owns
 * named steps inside every workflow, its output is stored beside the decision a
 * person made, and it is structurally barred from deciding anything — the
 * workflow definitions refuse to load if a step marked `requiresDecision` is
 * given to anything other than an employee.
 *
 * What is not wired is the language model behind it. That lives in the
 * customer-facing engine, which is protected code needing explicit sign-off to
 * extend. Rather than ship a chat box that fabricates answers about claim
 * procedure — the most dangerous possible placeholder in an insurance product —
 * this page shows the assistant's actual remit, drawn from the definitions the
 * server runs, and says what remains.
 */
export default function AssistantPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .workflows()
      .then((data) => {
        if (!cancelled) setDefinitions(data.definitions);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load workflows.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">AI Assistant</h1>
        <p className="mt-1 max-w-2xl text-pretty text-body-sm text-content-secondary">
          The assistant works inside your cases rather than beside them. It reads the documents,
          checks consistency and drafts a recommendation — and then hands the decision to you.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-card border border-brand/30 bg-brand/5 px-4 py-3">
        <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <p className="text-body-sm font-medium text-content">It never decides.</p>
          <p className="mt-1 text-pretty text-body-sm text-content-secondary">
            Every workflow ends at a person. A step that carries a decision cannot be completed by
            the assistant — the platform refuses to start if a workflow is ever written that way.
            Where you disagree with a recommendation, your decision is what is recorded, and the
            disagreement is kept.
          </p>
        </div>
      </div>

      <Panel title="Where the assistant works">
        {error ? (
          <Empty icon="close">{error}</Empty>
        ) : definitions === null ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {definitions.map((definition) => (
              <li key={definition.definition}>
                <h3 className="text-body font-semibold text-content">{definition.label}</h3>
                <ol className="mt-3 flex flex-col gap-2">
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
                              ? "You"
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
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="What is not connected yet">
        <p className="text-pretty text-body-sm text-content-secondary">
          The assistant&rsquo;s conversational surface — asking it a question in your own words
          about a product, an SOP or an IRDAI circular — is not wired to a language model in this
          release. The steps above are real and enforced; the free-form answers are not, and a chat
          box that invents claim procedure would be worse than none at all.
        </p>
        <p className="mt-3 text-pretty text-body-sm text-content-secondary">
          In the meantime the{" "}
          <a
            href="/knowledge"
            className="focus-ring rounded text-brand underline underline-offset-4"
          >
            Knowledge Center
          </a>{" "}
          searches the same material the assistant will draw on.
        </p>
      </Panel>
    </div>
  );
}
