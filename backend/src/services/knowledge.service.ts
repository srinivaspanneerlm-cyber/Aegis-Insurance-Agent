/**
 * The knowledge service: authorship, review, versioning and analytics.
 *
 * Two rules shape it.
 *
 * **Nothing reaches a reader until a second person approves it.** An author
 * cannot approve their own article — `assertCanApprove` needs review authority
 * that `knowledge.write` alone does not confer. For a platform that quotes
 * IRDAI regulation to customers, a one-person path from "I typed this" to
 * "customers are told this" is the defect, not the workflow.
 *
 * **Every approved change is kept.** A version row is written before the
 * article is updated, so "what did our guidance say on the day we gave that
 * advice" has an answer. An UPDATE that overwrites the answer destroys the only
 * evidence that the advice was right at the time.
 */
import AppError from "../utils/appError";
import { auditService } from "./audit.service";
import {
  categoryRepository,
  knowledgeRepository,
  reviewRepository,
  searchIndexRepository,
  tagRepository,
  versionRepository,
} from "../knowledge/repository";
import { buildIndexEntries } from "../knowledge/search";
import { knowledgePermissionService } from "../knowledge/router";
import {
  isKnowledgeCategory,
  type Actor,
  type ArticleInput,
  type KnowledgeService,
} from "../knowledge/contracts";
import prisma from "../config/db";

const CLASSIFICATIONS = new Set(["PUBLIC", "INTERNAL", "RESTRICTED"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Slug collisions get a numeric suffix rather than an error the author must solve. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || "article";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await knowledgeRepository.slugExists(candidate, exceptId);
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

function validate(input: Partial<ArticleInput>, requireAll: boolean): void {
  if (requireAll || input.title !== undefined) {
    if (!input.title?.trim()) throw new AppError("An article needs a title.", 400, "TITLE_REQUIRED");
  }
  if (requireAll || input.summary !== undefined) {
    if (!input.summary?.trim()) {
      // The summary is what a search result and an AI answer quote. An article
      // without one is an article that shows up blank wherever it matters.
      throw new AppError(
        "An article needs a summary — it is what search results and AI answers quote.",
        400,
        "SUMMARY_REQUIRED"
      );
    }
  }
  if (requireAll || input.body !== undefined) {
    if (!input.body?.trim()) throw new AppError("An article needs a body.", 400, "BODY_REQUIRED");
  }
  if (requireAll || input.category !== undefined) {
    if (!isKnowledgeCategory(input.category)) {
      throw new AppError("That is not a document type we recognise.", 400, "UNKNOWN_CATEGORY");
    }
  }
  if (input.classification && !CLASSIFICATIONS.has(input.classification)) {
    throw new AppError("That is not a classification we recognise.", 400, "UNKNOWN_CLASSIFICATION");
  }
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo <= input.effectiveFrom) {
    throw new AppError(
      "Guidance cannot stop applying before it starts.",
      400,
      "INVALID_EFFECTIVE_WINDOW"
    );
  }
}

export const knowledgeService: KnowledgeService = {
  /** Creates a DRAFT. Nothing is published by writing it. */
  async create(actor: Actor, input: ArticleInput) {
    knowledgePermissionService.assertCanWrite(actor);
    validate(input, true);

    const slug = await uniqueSlug(input.slug ? slugify(input.slug) : slugify(input.title));

    const article = await knowledgeRepository.create({
      slug,
      title: input.title.trim(),
      category: input.category,
      summary: input.summary.trim(),
      body: input.body,
      tags: input.tags?.length ? input.tags.join(",") : null,
      departments: input.departments?.length ? input.departments.join(",") : null,
      classification: input.classification ?? "INTERNAL",
      // Always DRAFT. There is no create-and-publish path, because the one that
      // exists is the one somebody uses in a hurry.
      status: "DRAFT",
      sourceRef: input.sourceRef ?? null,
      sourceKind: input.sourceKind ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      reviewDueAt: input.reviewDueAt ?? null,
      authorId: actor.id,
      version: 1,
    });

    if (input.tags?.length) await tagRepository.syncFor(article.id, input.tags);

    auditService.record({
      actorId: actor.id,
      action: "knowledge.created",
      entity: "KnowledgeArticle",
      entityId: article.id,
      metadata: { slug, category: input.category, classification: article.classification },
    });

    return article;
  },

  /**
   * Edits an article.
   *
   * Editing an APPROVED article returns it to DRAFT. Guidance that changed
   * without being re-reviewed is guidance nobody has checked, and leaving it
   * APPROVED would let an edit bypass the review step entirely.
   */
  async update(actor: Actor, id: string, input: Partial<ArticleInput>) {
    knowledgePermissionService.assertCanWrite(actor);
    validate(input, false);

    const existing = await knowledgeRepository.findById(id);
    if (!existing) throw new AppError("That article does not exist.", 404, "NOT_FOUND");
    if (existing.status === "ARCHIVED") {
      throw new AppError(
        "This article is archived. Create a new one rather than reviving guidance that was withdrawn.",
        409,
        "ARTICLE_ARCHIVED"
      );
    }

    const contentChanged =
      (input.title !== undefined && input.title !== existing.title) ||
      (input.summary !== undefined && input.summary !== existing.summary) ||
      (input.body !== undefined && input.body !== existing.body);

    // Snapshot before the change, not after — the version records what it *was*.
    if (contentChanged) {
      await versionRepository.create({
        articleId: id,
        version: existing.version,
        title: existing.title,
        summary: existing.summary,
        body: existing.body,
        changeNote: input.changeNote ?? null,
        authoredById: actor.id,
      });
    }

    const wasApproved = existing.status === "APPROVED";

    const updated = await knowledgeRepository.update(id, {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.summary !== undefined ? { summary: input.summary.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.tags !== undefined ? { tags: input.tags.length ? input.tags.join(",") : null } : {}),
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
      ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
      ...(input.reviewDueAt !== undefined ? { reviewDueAt: input.reviewDueAt } : {}),
      ...(contentChanged
        ? {
            version: existing.version + 1,
            // Back to DRAFT, and out of the index — see below.
            status: "DRAFT",
            approvedById: null,
            approvedAt: null,
          }
        : {}),
    });

    // An edited article leaves the search index immediately. Leaving it in
    // would keep serving the old text under a title that has changed, which is
    // worse than not finding it at all.
    if (contentChanged && wasApproved) {
      await searchIndexRepository.removeFor(id);
    }

    if (input.tags !== undefined) await tagRepository.syncFor(id, input.tags ?? []);

    auditService.record({
      actorId: actor.id,
      action: "knowledge.updated",
      entity: "KnowledgeArticle",
      entityId: id,
      metadata: { version: updated.version, contentChanged, returnedToDraft: contentChanged && wasApproved },
    });

    return updated;
  },

  async submitForReview(actor: Actor, id: string) {
    knowledgePermissionService.assertCanWrite(actor);
    const article = await knowledgeRepository.findById(id);
    if (!article) throw new AppError("That article does not exist.", 404, "NOT_FOUND");
    if (article.status !== "DRAFT") {
      throw new AppError(`This article is ${article.status.toLowerCase()}, not a draft.`, 409, "NOT_A_DRAFT");
    }

    const updated = await knowledgeRepository.update(id, { status: "IN_REVIEW" });
    auditService.record({
      actorId: actor.id,
      action: "knowledge.submitted",
      entity: "KnowledgeArticle",
      entityId: id,
    });
    return updated;
  },

  /**
   * A reviewer's decision. The only path to APPROVED.
   *
   * An author cannot approve their own work: the check is here rather than in
   * the permission service because it depends on the article, not the role.
   */
  async review(actor: Actor, id: string, decision, notes?: string) {
    knowledgePermissionService.assertCanApprove(actor);

    const article = await knowledgeRepository.findById(id);
    if (!article) throw new AppError("That article does not exist.", 404, "NOT_FOUND");
    if (article.status !== "IN_REVIEW") {
      throw new AppError("This article is not waiting for review.", 409, "NOT_IN_REVIEW");
    }

    if (article.authorId === actor.id) {
      throw new AppError(
        "You wrote this article, so somebody else has to approve it.",
        403,
        "SELF_APPROVAL"
      );
    }

    // A rejection without a reason is a dead end for the author — the same rule
    // the document platform applies to a rejected document.
    if (decision !== "APPROVED" && !notes?.trim()) {
      throw new AppError(
        "Say what needs changing. A rejection without a reason leaves the author guessing.",
        400,
        "REASON_REQUIRED"
      );
    }

    await reviewRepository.create({
      articleId: id,
      decision,
      reviewerId: actor.id,
      notes: notes?.trim() ?? null,
    });

    const status =
      decision === "APPROVED" ? "APPROVED" : decision === "REJECTED" ? "DRAFT" : "DRAFT";

    const updated = await knowledgeRepository.update(id, {
      status,
      ...(decision === "APPROVED"
        ? { approvedById: actor.id, approvedAt: new Date(), publishedAt: new Date() }
        : {}),
    });

    // Indexed only on approval. The index is the set of things that can be
    // found, and a draft that could be found is a draft that has been published
    // by accident.
    if (decision === "APPROVED") {
      const entries = buildIndexEntries(updated);
      await searchIndexRepository.rebuildFor(id, entries);
    }

    auditService.record({
      actorId: actor.id,
      action: `knowledge.${decision.toLowerCase()}`,
      entity: "KnowledgeArticle",
      entityId: id,
      metadata: { decision, version: updated.version, notes: notes ?? null },
    });

    return updated;
  },

  /** Withdraws guidance. Never deletes it. */
  async archive(actor: Actor, id: string, reason: string) {
    knowledgePermissionService.assertCanApprove(actor);
    if (!reason?.trim()) {
      throw new AppError("Say why this guidance is being withdrawn.", 400, "REASON_REQUIRED");
    }

    const article = await knowledgeRepository.findById(id);
    if (!article) throw new AppError("That article does not exist.", 404, "NOT_FOUND");

    // The final state is kept as a version, so an archived article's last words
    // survive alongside its history.
    await versionRepository.create({
      articleId: id,
      version: article.version,
      title: article.title,
      summary: article.summary,
      body: article.body,
      changeNote: `Archived: ${reason.trim()}`,
      authoredById: actor.id,
    });

    const updated = await knowledgeRepository.update(id, {
      status: "ARCHIVED",
      archivedAt: new Date(),
    });

    // Out of the index. Archived guidance must stop being findable, but the row
    // stays so a past decision can still be explained.
    await searchIndexRepository.removeFor(id);

    auditService.record({
      actorId: actor.id,
      action: "knowledge.archived",
      entity: "KnowledgeArticle",
      entityId: id,
      metadata: { reason: reason.trim() },
    });

    return updated;
  },

  /** One article, if this caller may see it. */
  async get(actor: Actor, idOrSlug: string) {
    const canEdit = await (async () => {
      try {
        knowledgePermissionService.assertCanWrite(actor);
        return true;
      } catch {
        return false;
      }
    })();

    const article = await knowledgeRepository.findVisible(actor, idOrSlug, {
      includeUnapproved: canEdit,
    });
    if (!article) throw new AppError("That article does not exist.", 404, "NOT_FOUND");

    const decision = await knowledgePermissionService.canRead(actor, article);
    if (!decision.allowed) {
      // 404, not 403. A 403 on a restricted compliance document confirms it
      // exists, which is itself the disclosure the classification prevents.
      throw new AppError("That article does not exist.", 404, "NOT_FOUND");
    }

    knowledgeRepository.recordView(article.id);
    return article;
  },

  async history(actor: Actor, id: string) {
    const article = await this.get(actor, id);
    const typed = article as { id: string; version: number };
    const [versions, reviews] = await Promise.all([
      versionRepository.listFor(typed.id),
      reviewRepository.listFor(typed.id),
    ]);
    return { articleId: typed.id, currentVersion: typed.version, versions, reviews };
  },

  /**
   * What the knowledge base is doing, for whoever maintains it.
   *
   * Leads with what is *wrong* — stale, unreviewed, unread — because a
   * dashboard of totals tells a knowledge manager nothing they can act on.
   */
  async analytics(actor: Actor) {
    knowledgePermissionService.assertCanWrite(actor);

    const now = new Date();
    const [byStatus, byCategory, staleForReview, expiringSoon, unread, mostRead, indexed, tags] =
      await Promise.all([
        prisma.knowledgeArticle.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.knowledgeArticle.groupBy({
          by: ["category"],
          where: { status: "APPROVED" },
          _count: { _all: true },
        }),
        knowledgeRepository.dueForReview(20),
        prisma.knowledgeArticle.findMany({
          where: {
            status: "APPROVED",
            effectiveTo: { not: null, gt: now, lte: new Date(now.getTime() + 30 * 86_400_000) },
          },
          select: { id: true, title: true, effectiveTo: true },
          take: 20,
        }),
        prisma.knowledgeArticle.count({ where: { status: "APPROVED", viewCount: 0 } }),
        prisma.knowledgeArticle.findMany({
          where: { status: "APPROVED", viewCount: { gt: 0 } },
          orderBy: { viewCount: "desc" },
          take: 10,
          select: { id: true, title: true, category: true, viewCount: true, lastViewedAt: true },
        }),
        searchIndexRepository.totalIndexed(),
        tagRepository.popular(15),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    return {
      totals: {
        byStatus: statusCounts,
        byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
        indexedForSearch: indexed,
      },
      needsAttention: {
        overdueForReview: staleForReview,
        expiringWithin30Days: expiringSoon,
        approvedButNeverRead: unread,
      },
      mostRead,
      popularTags: tags,
      /**
       * Whether search actually helps people.
       *
       * Nothing records what was searched for or whether the searcher opened a
       * result, so a "search success rate" would be invented. The view counter
       * says an article was opened, not that a search led there.
       */
      searchEffectiveness: {
        available: false,
        reason: "Queries and their outcomes are not recorded.",
        needs:
          "A search log writing the query, the hit count, and whether a result was opened — deliberately not added without a decision about retaining what staff type into a search box.",
      },
    };
  },
};

/** The twelve domain categories the platform files knowledge under. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  slug: string;
  name: string;
  domain?: string;
  position: number;
}> = [
  { slug: "motor", name: "Motor", domain: "motor", position: 1 },
  { slug: "health", name: "Health", domain: "health", position: 2 },
  { slug: "life", name: "Life", domain: "life", position: 3 },
  { slug: "travel", name: "Travel", domain: "travel", position: 4 },
  { slug: "property", name: "Property", domain: "property", position: 5 },
  { slug: "commercial", name: "Commercial", domain: "commercial", position: 6 },
  { slug: "operations", name: "Operations", position: 7 },
  { slug: "compliance", name: "Compliance", position: 8 },
  { slug: "customer-service", name: "Customer Service", position: 9 },
  { slug: "claims", name: "Claims", position: 10 },
  { slug: "analytics", name: "Analytics", position: 11 },
  { slug: "administration", name: "Administration", position: 12 },
];

/** Idempotent; safe to call on every boot. */
export async function ensureCategories(): Promise<number> {
  let count = 0;
  for (const category of DEFAULT_CATEGORIES) {
    await categoryRepository.upsert({
      slug: category.slug,
      name: category.name,
      domain: category.domain ?? null,
      position: category.position,
    });
    count += 1;
  }
  return count;
}
