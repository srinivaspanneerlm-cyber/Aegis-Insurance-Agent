"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Lock, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import { activeStep, overallProgress, type WorkflowStepView } from "@/lib/documents/workflowSteps";
import type { DocumentLocale, WorkflowStepId } from "@/types/documents";

interface WorkflowAccordionProps {
  steps: WorkflowStepView[];
  locale?: DocumentLocale;
  /** Steps open on first render. Defaults to whichever step is active. */
  defaultOpenIds?: WorkflowStepId[];
  /** Body for a step — e.g. the upload cards that belong inside `upload`. */
  renderStep?: (step: WorkflowStepView) => ReactNode;
  className?: string;
}

/**
 * The application, as a list the customer can open one step at a time.
 *
 * A real disclosure widget: every header is a button that owns its panel, and
 * arrow keys walk the headers. Steps stay expandable even while locked — a
 * customer who wants to know what payment will involve should be able to look
 * ahead rather than be refused by a disabled control.
 *
 * The tick is deliberate. A step earns the green check only when its outcome
 * was genuinely proven; a step that finished with nothing confirmed gets a
 * neutral dash and a line saying so.
 */
export function WorkflowAccordion({
  steps,
  locale = "en",
  defaultOpenIds,
  renderStep,
  className,
}: WorkflowAccordionProps) {
  const baseId = useId();
  const headerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeId = activeStep(steps)?.id;

  const [openIds, setOpenIds] = useState<WorkflowStepId[]>(
    () => defaultOpenIds ?? (activeId ? [activeId] : []),
  );

  // Follow the customer forward: reveal a step as it becomes current, but never
  // collapse one they chose to open.
  useEffect(() => {
    if (!activeId) return;
    setOpenIds((ids) => (ids.includes(activeId) ? ids : [...ids, activeId]));
  }, [activeId]);

  const toggle = (id: WorkflowStepId) =>
    setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleHeaderKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = steps.length - 1;
    const focus = (i: number) => {
      e.preventDefault();
      headerRefs.current[i]?.focus();
    };

    if (e.key === "ArrowDown") focus(index === last ? 0 : index + 1);
    else if (e.key === "ArrowUp") focus(index === 0 ? last : index - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(last);
  };

  const percent = overallProgress(steps);

  return (
    <section
      aria-label="Application progress"
      className={cn(
        "overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]",
        className,
      )}
    >
      <header className="border-b border-white/8 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-bold text-slate-100">Your application</h3>
          <span className="text-[11px] font-black tabular-nums text-cyan-300">{percent}%</span>
        </div>

        <div
          role="progressbar"
          aria-label="Overall completion"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/8"
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.32 }}
          />
        </div>
      </header>

      <ul className="divide-y divide-white/[0.06]">
        {steps.map((step, i) => {
          const open = openIds.includes(step.id);
          const headerId = `${baseId}-h-${step.id}`;
          const panelId = `${baseId}-p-${step.id}`;
          const title = localise(step.title, locale);

          return (
            <li key={step.id}>
              <h4>
                <button
                  ref={(el) => {
                    headerRefs.current[i] = el;
                  }}
                  id={headerId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? panelId : undefined}
                  onClick={() => toggle(step.id)}
                  onKeyDown={(e) => handleHeaderKeyDown(e, i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/60",
                    "hover:bg-white/[0.03]",
                  )}
                >
                  <StepGlyph step={step} index={i} />

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[12px] font-bold",
                        step.status === "locked" ? "text-slate-500" : "text-slate-100",
                      )}
                    >
                      {title}
                    </span>
                    {step.detail && (
                      <span className="block truncate text-[10px] font-medium text-slate-500">
                        {localise(step.detail, locale)}
                      </span>
                    )}
                  </span>

                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-slate-500 transition-transform duration-200",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              </h4>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 px-4 pb-4">
                      {step.description && (
                        <p className="text-[11px] font-medium leading-relaxed text-slate-400">
                          {localise(step.description, locale)}
                        </p>
                      )}

                      {step.progress > 0 && step.progress < 100 && (
                        <div
                          role="progressbar"
                          aria-label={`${title} progress`}
                          aria-valuenow={step.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-1 overflow-hidden rounded-full bg-white/8"
                        >
                          <div
                            className="h-full rounded-full bg-cyan-400/70"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      )}

                      {renderStep?.(step)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The status marker beside a step title. */
function StepGlyph({ step, index }: { step: WorkflowStepView; index: number }) {
  const shell =
    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-black";

  if (step.status === "done" && step.verified) {
    return (
      <span className={cn(shell, "border-emerald-400/30 bg-emerald-500/10 text-emerald-300")}>
        <Check className="h-3 w-3 stroke-[3]" aria-hidden />
        <span className="sr-only">Done</span>
      </span>
    );
  }

  // Finished, but nothing about it was actually confirmed — say so instead of
  // handing out a tick the evidence does not support.
  if (step.status === "done") {
    return (
      <span className={cn(shell, "border-white/10 bg-white/5 text-slate-400")}>
        <Minus className="h-3 w-3 stroke-[3]" aria-hidden />
        <span className="sr-only">Finished, nothing confirmed</span>
      </span>
    );
  }

  if (step.status === "locked") {
    return (
      <span className={cn(shell, "border-white/8 bg-white/[0.02] text-slate-600")}>
        <Lock className="h-2.5 w-2.5" aria-hidden />
        <span className="sr-only">Not yet</span>
      </span>
    );
  }

  return (
    <span className={cn(shell, "border-cyan-400/40 bg-cyan-500/10 text-cyan-300")}>
      {index + 1}
      <span className="sr-only">In progress</span>
    </span>
  );
}
