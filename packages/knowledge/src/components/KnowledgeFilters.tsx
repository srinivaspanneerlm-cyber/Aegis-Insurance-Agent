"use client";

import { useId } from "react";
import {
  KNOWLEDGE_TYPES,
  TYPE_LABEL,
  type KnowledgeCategory,
  type KnowledgeTag,
} from "../lib/types";

export interface KnowledgeFilterValues {
  category: string;
  status: string;
  tag: string;
  classification: string;
  updatedSince: string;
}

export interface KnowledgeFiltersProps {
  values: KnowledgeFilterValues;
  onChange: (values: KnowledgeFilterValues) => void;
  tags?: KnowledgeTag[];
  categories?: KnowledgeCategory[];
  /** Governance filters are hidden from readers who cannot see drafts. */
  showGovernance?: boolean;
  /** Which filters the server applied; the rest narrow only the current page. */
  serverFiltered?: readonly string[];
}

/**
 * The filter set.
 *
 * A `<fieldset>` with a legend rather than a row of bare selects, so the group
 * is announced as one thing. Every control has a visible label — placeholder
 * text disappears the moment somebody chooses a value, which is exactly when
 * they need to know what it was.
 *
 * `serverFiltered` is surfaced honestly: tag, classification and date narrow
 * only what has already been fetched, because the Phase A list endpoint does
 * not accept them. Saying so beats a filter that silently misses results on
 * page two.
 */
export function KnowledgeFilters({
  values,
  onChange,
  tags = [],
  categories = [],
  showGovernance = true,
  serverFiltered = [],
}: KnowledgeFiltersProps) {
  const ids = {
    category: useId(),
    status: useId(),
    tag: useId(),
    classification: useId(),
    since: useId(),
  };

  const set = <K extends keyof KnowledgeFilterValues>(key: K, value: string) =>
    onChange({ ...values, [key]: value });

  const active = Object.values(values).filter(Boolean).length;
  const clientOnly = ["tag", "classification", "updatedSince"].filter(
    (f) => !serverFiltered.includes(f) && values[f as keyof KnowledgeFilterValues]
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-body-sm text-content font-semibold">Narrow this down</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor={ids.category}>
          <select
            id={ids.category}
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            className={SELECT}
          >
            <option value="">Any type</option>
            {KNOWLEDGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        {categories.length > 0 ? (
          <Field label="Area" htmlFor={`${ids.category}-area`}>
            <select
              id={`${ids.category}-area`}
              value={values.tag && categories.some((c) => c.slug === values.tag) ? values.tag : ""}
              onChange={(e) => set("tag", e.target.value)}
              className={SELECT}
            >
              <option value="">Any area</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {showGovernance ? (
          <>
            <Field label="Approval status" htmlFor={ids.status}>
              <select
                id={ids.status}
                value={values.status}
                onChange={(e) => set("status", e.target.value)}
                className={SELECT}
              >
                <option value="">Any status</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">Waiting for a reviewer</option>
                <option value="APPROVED">Published</option>
                <option value="ARCHIVED">Withdrawn</option>
              </select>
            </Field>

            <Field label="Visibility" htmlFor={ids.classification}>
              <select
                id={ids.classification}
                value={values.classification}
                onChange={(e) => set("classification", e.target.value)}
                className={SELECT}
              >
                <option value="">Any visibility</option>
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL">Internal</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </Field>
          </>
        ) : null}

        <Field label="Updated since" htmlFor={ids.since}>
          <input
            id={ids.since}
            type="date"
            value={values.updatedSince}
            onChange={(e) => set("updatedSince", e.target.value)}
            className={SELECT}
          />
        </Field>

        {tags.length > 0 ? (
          <Field label="Tag" htmlFor={ids.tag}>
            <select
              id={ids.tag}
              value={values.tag}
              onChange={(e) => set("tag", e.target.value)}
              className={SELECT}
            >
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} ({t.usageCount})
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {active > 0 ? (
          <button
            type="button"
            onClick={() =>
              onChange({ category: "", status: "", tag: "", classification: "", updatedSince: "" })
            }
            className="focus-ring rounded-control border-line/60 text-caption text-content border px-3 py-1.5 font-medium"
          >
            Clear {active} filter{active === 1 ? "" : "s"}
          </button>
        ) : null}

        {clientOnly.length > 0 ? (
          <p className="text-caption text-content-muted text-pretty">
            {clientOnly.join(", ")} {clientOnly.length === 1 ? "narrows" : "narrow"} the articles
            already loaded, not the whole library.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

const SELECT =
  "h-9 w-full rounded-control border border-line/60 bg-surface-raised/40 px-2.5 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-caption text-content-secondary font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
