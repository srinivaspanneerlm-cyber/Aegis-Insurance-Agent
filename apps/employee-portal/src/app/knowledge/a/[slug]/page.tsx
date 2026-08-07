"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KnowledgePreview,
  VersionHistory,
  useArticle,
  useBookmarks,
  useHistory,
  STATUS_META,
} from "@aegis/knowledge";
import { Panel, Skeleton } from "@/components/Cards";
import { knowledgeClient } from "@/lib/knowledgeClient";

/**
 * One article, with the history of what it used to say.
 *
 * The viewer sits above the body rather than beside it, because the questions
 * "is this still in force" and "where did it come from" have to be answered
 * before somebody reads the guidance, not after.
 */
export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const article = useArticle(knowledgeClient, slug);
  const bookmarks = useBookmarks();
  const [showHistory, setShowHistory] = useState(false);

  const history = useHistory(knowledgeClient, showHistory && article.data ? article.data.id : null);

  if (article.loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (article.error || !article.data) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <p role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {/* 404 here means "not visible to you" as often as "does not exist" —
              the API deliberately does not distinguish, and neither should this. */}
          {article.code === "NOT_FOUND"
            ? "We could not find that guidance, or it is not available to you."
            : (article.error ?? "Something went wrong.")}
        </p>
        <button
          type="button"
          onClick={() => router.push("/knowledge/workspace")}
          className="focus-ring mt-4 rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content"
        >
          Back to knowledge
        </button>
      </div>
    );
  }

  const status = STATUS_META[article.data.status];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => router.push("/knowledge/workspace")}
          className="focus-ring rounded text-caption font-medium text-brand"
        >
          ← Knowledge
        </button>
      </nav>

      <KnowledgePreview article={article.data} why={status.hint} />

      <Panel title="The guidance">
        <div className="prose-sm max-w-none whitespace-pre-wrap text-pretty text-body-sm text-content">
          {article.data.body ?? article.data.summary}
        </div>
      </Panel>

      <Panel title="History">
        {!showHistory ? (
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content"
          >
            Show what this used to say
          </button>
        ) : history.loading ? (
          <Skeleton className="h-32 w-full" />
        ) : history.error ? (
          <p role="alert" className="text-body-sm text-danger">
            {history.error}
          </p>
        ) : history.data ? (
          <VersionHistory history={history.data} />
        ) : null}
      </Panel>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => bookmarks.toggle(article.data!.id)}
          className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content"
        >
          {bookmarks.has(article.data.id) ? "Remove bookmark" : "Save on this device"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/knowledge/console?article=${article.data!.id}`)}
          className="focus-ring rounded-control border border-line/60 px-3 py-1.5 text-caption font-medium text-content-secondary"
        >
          Manage in the console
        </button>
      </div>
    </div>
  );
}
