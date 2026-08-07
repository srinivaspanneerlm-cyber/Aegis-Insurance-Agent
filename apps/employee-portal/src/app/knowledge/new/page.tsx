"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KnowledgeError, KNOWLEDGE_TYPES, TYPE_LABEL } from "@aegis/knowledge";
import { Panel } from "@/components/Cards";
import { knowledgeClient } from "@/lib/knowledgeClient";

/**
 * Writing guidance.
 *
 * Saving produces a draft, always — there is no publish button here, because
 * the only path to published runs through somebody else's review. The form says
 * so rather than leaving an author to discover it.
 *
 * The summary field explains what it is for. It is what search results and AI
 * answers quote, so an author who treats it as an afterthought produces an
 * article that shows up blank in the two places it matters most.
 */
function EditorForm({ articleId }: { articleId: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    category: "REGULATION",
    summary: "",
    body: "",
    tags: "",
    classification: "INTERNAL",
    sourceRef: "",
    effectiveFrom: "",
    effectiveTo: "",
    changeNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        summary: form.summary,
        body: form.body,
        classification: form.classification,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(form.sourceRef ? { sourceRef: form.sourceRef } : {}),
        ...(form.effectiveFrom ? { effectiveFrom: form.effectiveFrom } : {}),
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
        ...(form.changeNote ? { changeNote: form.changeNote } : {}),
      };

      const saved = articleId
        ? await knowledgeClient.updateArticle(articleId, payload)
        : await knowledgeClient.createArticle(payload);

      router.push(`/knowledge/a/${saved.slug}`);
    } catch (err) {
      setError(err instanceof KnowledgeError ? err.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <Field label="Title" htmlFor="title">
        <input
          id="title"
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={INPUT}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="category">
          <select
            id="category"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className={INPUT}
          >
            {KNOWLEDGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Who can read it"
          htmlFor="classification"
          hint="Restricted needs a named grant — nobody sees it without one."
        >
          <select
            id="classification"
            value={form.classification}
            onChange={(e) => set("classification", e.target.value)}
            className={INPUT}
          >
            <option value="PUBLIC">Public — customers can read this</option>
            <option value="INTERNAL">Internal — staff only</option>
            <option value="RESTRICTED">Restricted — by grant only</option>
          </select>
        </Field>
      </div>

      <Field
        label="Summary"
        htmlFor="summary"
        hint="This is what search results and AI answers quote. Write it as the answer, not as a description."
      >
        <textarea
          id="summary"
          required
          rows={2}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={INPUT}
        />
      </Field>

      <Field label="The guidance" htmlFor="body">
        <textarea
          id="body"
          required
          rows={12}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          className={INPUT}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Where it comes from"
          htmlFor="sourceRef"
          hint="A circular number or document reference. Advice that cannot be traced cannot be defended."
        >
          <input
            id="sourceRef"
            value={form.sourceRef}
            onChange={(e) => set("sourceRef", e.target.value)}
            placeholder="IRDAI/HLT/REG/2024-25"
            className={INPUT}
          />
        </Field>

        <Field label="Tags" htmlFor="tags" hint="Comma separated.">
          <input
            id="tags"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="motor, claims"
            className={INPUT}
          />
        </Field>

        <Field label="In force from" htmlFor="effectiveFrom">
          <input
            id="effectiveFrom"
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => set("effectiveFrom", e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          label="Stops applying"
          htmlFor="effectiveTo"
          hint="Leave blank if it does not expire. After this date it stops answering questions."
        >
          <input
            id="effectiveTo"
            type="date"
            value={form.effectiveTo}
            onChange={(e) => set("effectiveTo", e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      {articleId ? (
        <Field
          label="What changed"
          htmlFor="changeNote"
          hint="Kept with the version, for whoever reads it later."
        >
          <input
            id="changeNote"
            value={form.changeNote}
            onChange={(e) => set("changeNote", e.target.value)}
            className={INPUT}
          />
        </Field>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="focus-ring rounded-control bg-brand px-5 py-2.5 text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as draft"}
        </button>
        <p className="mt-2 text-pretty text-caption text-content-muted">
          Saving creates a draft. Somebody other than you has to approve it before anyone else can
          read it.
        </p>
      </div>
    </form>
  );
}

const INPUT =
  "w-full rounded-control border border-line/60 bg-surface-raised/40 px-3 py-2 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-content">
        {label}
      </label>
      {children}
      {hint ? <p className="text-pretty text-caption text-content-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Reads `?id=` to switch between writing and editing.
 *
 * `useSearchParams` opts this subtree out of prerendering, so the page is a
 * thin wrapper around a client form rather than the whole route — the same
 * shape the identity app needed after it served an empty document.
 */
export default function NewKnowledgePage() {
  const params = useSearchParams();
  const id = params.get("id");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">
          {id ? "Edit guidance" : "Write guidance"}
        </h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          {id
            ? "Editing published guidance returns it to draft — it has to be reviewed again."
            : "Everything here starts as a draft."}
        </p>
      </header>

      <Panel title={id ? "Changes" : "New article"}>
        <EditorForm articleId={id} />
      </Panel>
    </div>
  );
}
