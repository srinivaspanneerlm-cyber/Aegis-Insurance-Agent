"use client";

import { cn } from "@aegis/utils";
import {
  CLASSIFICATION_META,
  STATUS_META,
  TONE_BORDER,
  TYPE_LABEL,
  effectiveState,
  tagsOf,
  timeAgo,
  type KnowledgeArticle,
} from "../lib/types";

export interface KnowledgePreviewProps {
  article: KnowledgeArticle;
  /** How sure the assistant is that this answers the question, if it said. */
  confidence?: number | null;
  /** Why this article was surfaced — the router's reasoning, or a match note. */
  why?: string | null;
  relatedDocuments?: Array<{ id: string; label: string; href?: string }>;
  onOpen?: (article: KnowledgeArticle) => void;
}

/**
 * The AI Knowledge Viewer: what an assistant cites, and what it rests on.
 *
 * This is the component that appears when the platform answers a question from
 * guidance, and it exists to make the citation checkable. It always shows the
 * source reference, the version, when it was last updated, and whether the
 * guidance is still in force — because an answer quoted from a circular that
 * expired last month is worse than no answer, and nothing else on the screen
 * would reveal it.
 *
 * Confidence, when the assistant supplied one, is shown in words with the
 * number beside it. An answer presented without any indication of certainty is
 * read as certain.
 */
export function KnowledgePreview({
  article,
  confidence,
  why,
  relatedDocuments = [],
  onOpen,
}: KnowledgePreviewProps) {
  const status = STATUS_META[article.status];
  const classification = CLASSIFICATION_META[article.classification];
  const effective = effectiveState(article);
  const tags = tagsOf(article);
  const stale = effective.state === "EXPIRED" || effective.state === "NOT_YET";

  return (
    <article
      className={cn(
        "rounded-card border p-4",
        stale ? "border-warning/40 bg-warning/5" : "border-line/50 bg-surface-raised/30"
      )}
    >
      {stale ? (
        // An alert, not a badge. Quoting withdrawn guidance to a customer is the
        // failure this whole component exists to prevent.
        <p role="alert" className="text-caption text-warning mb-2 font-semibold">
          {effective.label} — check before relying on this.
        </p>
      ) : null}

      <p className="text-caption text-content-muted">
        {TYPE_LABEL[article.category] ?? article.category}
        <span className="mx-1.5" aria-hidden="true">
          ·
        </span>
        version {article.version}
      </p>

      <h3 className="text-body text-content mt-0.5 font-semibold text-pretty">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(article)}
            className="focus-ring hover:text-brand rounded text-left"
          >
            {article.title}
          </button>
        ) : (
          article.title
        )}
      </h3>

      <p className="text-body-sm text-content-secondary mt-2 text-pretty">{article.summary}</p>

      {why ? (
        <p className="text-caption text-content-secondary mt-2.5 text-pretty">
          <span className="text-content font-medium">Why this: </span>
          {why}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <Row label="Source">
          {article.sourceRef ? (
            <span className="font-mono text-[0.75rem]">{article.sourceRef}</span>
          ) : (
            // Named rather than blank: guidance with no traceable source is a
            // fact about the guidance worth knowing.
            <span className="text-content-muted italic">No source recorded</span>
          )}
        </Row>
        <Row label="Last updated">{timeAgo(article.updatedAt)}</Row>
        <Row label="Status">
          <span
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
              TONE_BORDER[status.tone]
            )}
          >
            {status.label}
          </span>
        </Row>
        <Row label="Visibility">
          <span
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[0.625rem] font-semibold",
              TONE_BORDER[classification.tone]
            )}
          >
            {classification.label}
          </span>
        </Row>
        {confidence !== null && confidence !== undefined ? (
          <Row label="How sure">
            {confidence >= 0.8 ? "Confident" : confidence >= 0.5 ? "Reasonably sure" : "Uncertain"}
            <span className="text-content-muted"> ({Math.round(confidence * 100)}%)</span>
          </Row>
        ) : null}
      </dl>

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill border-line/50 text-content-muted border px-2 py-0.5 text-[0.625rem]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {relatedDocuments.length > 0 ? (
        <section className="border-line/40 mt-3 border-t pt-3">
          <h4 className="text-caption text-content-muted mb-1.5 font-semibold tracking-wide uppercase">
            Related documents
          </h4>
          <ul className="flex flex-col gap-1">
            {relatedDocuments.map((doc) => (
              <li key={doc.id}>
                {doc.href ? (
                  <a href={doc.href} className="focus-ring text-body-sm text-brand rounded">
                    {doc.label}
                  </a>
                ) : (
                  <span className="text-body-sm text-content-secondary">{doc.label}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-content-muted">{label}</dt>
      <dd className="text-body-sm text-content mt-0.5">{children}</dd>
    </div>
  );
}
