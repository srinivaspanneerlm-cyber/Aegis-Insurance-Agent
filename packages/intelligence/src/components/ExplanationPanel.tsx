"use client";

import { cn } from "@aegis/utils";
import { confidenceLabel, type Explanation } from "../lib/types";

export interface ExplanationPanelProps {
  explanation: Explanation;
  className?: string;
}

/**
 * Why the platform said what it said.
 *
 * Every section is always rendered, including the unflattering ones. There is
 * no prop to hide the limitations and no variant that drops the alternatives —
 * a caller who could omit them would eventually omit them on the screen where
 * they matter most, which is the one where somebody is about to buy something.
 *
 * The order is deliberate: why, then how, then what it does *not* do, then what
 * happens if you ignore it, then what else you could do. Benefits sit in the
 * middle rather than at the top, because a panel that opens with benefits is a
 * sales page regardless of what follows.
 */
export function ExplanationPanel({ explanation, className }: ExplanationPanelProps) {
  const { why, how, benefits, limitations, risksOfInaction, alternatives, confidence } =
    explanation;
  const percent = Math.round(confidence.score * 100);

  return (
    <div className={cn("text-body-sm flex flex-col gap-5", className)}>
      <Section title="Why you are seeing this">
        <p className="text-content text-pretty">{why}</p>
      </Section>

      {how.length > 0 ? (
        <Section title="How we worked it out">
          {/* Ordered, because these are steps in an argument rather than a set
              of bullet points. A screen reader announces the position, which is
              the difference between a list and a derivation. */}
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {how.map((step) => (
              <li key={step} className="text-content-secondary text-pretty">
                {step}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {benefits.length > 0 ? (
        <Section title="What it covers">
          <ul className="flex flex-col gap-1.5">
            {benefits.map((b) => (
              <li key={b} className="text-content-secondary flex gap-2 text-pretty">
                <span aria-hidden="true" className="text-success shrink-0">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {limitations.length > 0 ? (
        <Section title="What it does not do">
          <ul className="flex flex-col gap-1.5">
            {limitations.map((l) => (
              <li key={l} className="text-content-secondary flex gap-2 text-pretty">
                <span aria-hidden="true" className="text-content-muted shrink-0">
                  —
                </span>
                {l}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {risksOfInaction.length > 0 ? (
        <Section title="If you do nothing">
          <ul className="flex flex-col gap-1.5">
            {risksOfInaction.map((r) => (
              <li key={r} className="text-content-secondary text-pretty">
                {r}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {alternatives.length > 0 ? (
        <Section title="What else you could do">
          <dl className="flex flex-col gap-3">
            {alternatives.map((alt) => (
              <div key={alt.option}>
                <dt className="text-content font-medium text-pretty">{alt.option}</dt>
                <dd className="text-content-secondary mt-0.5 text-pretty">{alt.whyNotChosen}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title="How sure we are">
        <p className="text-content text-pretty">
          {confidenceLabel(confidence.score)}{" "}
          <span className="text-content-muted">({percent}%)</span>
        </p>

        {confidence.basis.length > 0 ? (
          <p className="text-caption text-content-muted mt-1.5 text-pretty">
            Based on: {confidence.basis.join("; ")}.
          </p>
        ) : null}

        {confidence.improvedBy.length > 0 ? (
          <p className="text-caption text-content-secondary mt-1.5 text-pretty">
            This would improve if we knew {confidence.improvedBy.slice(0, 3).join(", ")}.
          </p>
        ) : null}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-caption text-content-muted mb-1.5 font-semibold tracking-wide uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}
