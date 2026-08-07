/**
 * The knowledge and memory repositories.
 *
 * Every query against these tables lives here. The services above hold the
 * rules — who may see what, what makes an article publishable — and never build
 * a `where` clause of their own.
 *
 * That split earns its keep in exactly one place, and it is the place that
 * matters: `visibilityFilter` is the only expression of "which articles may
 * this person see", so a new query cannot forget it. A service that assembled
 * its own filters would eventually assemble one that omitted the status check
 * and served a draft regulation to a customer.
 */
import prisma from "../config/db";
import type { Actor, Classification, KnowledgeStatus, MemoryScope } from "./contracts";
import { roleHasPermission } from "../auth/permissions";

const STAFF_REALMS = new Set(["EMPLOYEE", "ENTERPRISE", "PLATFORM"]);

/** The classifications a caller may read at all, before per-article grants. */
export function readableClassifications(actor: Actor): Classification[] {
  const staff = STAFF_REALMS.has(actor.realm ?? "") || roleHasPermission(actor.role, "knowledge.read");
  // A customer sees only what was written for customers. Everything else is
  // internal until somebody deliberately publishes it outward.
  return staff ? ["PUBLIC", "INTERNAL"] : ["PUBLIC"];
}

/**
 * The one definition of what a caller may see when browsing or searching.
 *
 * `RESTRICTED` enters only through `grantedIds` — the exact set of articles
 * this caller holds a live grant on. An earlier version excluded RESTRICTED
 * outright, which made grants unreachable: the article was filtered away before
 * the grant could be considered, so the whole permission feature was dead.
 */
export function visibilityFilter(
  actor: Actor,
  options: { includeUnapproved?: boolean; grantedIds?: readonly string[] } = {}
) {
  const canEdit = roleHasPermission(actor.role, "knowledge.write");
  const now = new Date();

  // RESTRICTED is reachable only through an id this caller has been granted.
  // Expressing it as an id list rather than a boolean is deliberate: a boolean
  // parameter is a filter that eventually gets passed `true` by mistake, and
  // this way the widest it can ever open is the exact set of articles somebody
  // was actually given.
  const granted = options.grantedIds ?? [];

  return {
    OR: [
      { classification: { in: readableClassifications(actor) } },
      ...(granted.length > 0
        ? [{ AND: [{ classification: "RESTRICTED" }, { id: { in: [...granted] } }] }]
        : []),
    ],
    // Unapproved content is visible only to people who can edit it, and only
    // when they ask. An assistant answering a customer never sets this.
    ...(options.includeUnapproved && canEdit
      ? { status: { in: ["DRAFT", "IN_REVIEW", "APPROVED"] as KnowledgeStatus[] } }
      : { status: "APPROVED" }),
    // Guidance that has not taken effect, or has been superseded, is not
    // guidance. A circular replaced in March must not answer an April question.
    AND: [
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
    ],
  };
}

export const ARTICLE_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  category: true,
  summary: true,
  status: true,
  classification: true,
  version: true,
  tags: true,
  sourceRef: true,
  sourceKind: true,
  effectiveFrom: true,
  effectiveTo: true,
  reviewDueAt: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  categoryId: true,
} as const;

export const knowledgeRepository = {
  findById(id: string) {
    return prisma.knowledgeArticle.findUnique({ where: { id } });
  },

  findByIdOrSlug(idOrSlug: string) {
    return prisma.knowledgeArticle.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
  },

  /**
   * A candidate for a single-article read.
   *
   * Classification is deliberately *not* filtered here — `knowledgeService.get`
   * always follows with `knowledgePermissionService.canRead`, which is the one
   * place that understands grants. Filtering here as well would mean a granted
   * article was excluded before the grant could be considered, which is exactly
   * the bug this shape avoids.
   *
   * Status and the effective window are still applied, because no grant makes a
   * draft or a withdrawn circular readable.
   */
  findVisible(actor: Actor, idOrSlug: string, options: { includeUnapproved?: boolean } = {}) {
    const canEdit = roleHasPermission(actor.role, "knowledge.write");
    const now = new Date();
    return prisma.knowledgeArticle.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(options.includeUnapproved && canEdit
          ? { status: { in: ["DRAFT", "IN_REVIEW", "APPROVED"] } }
          : { status: "APPROVED" }),
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
        ],
      },
    });
  },

  /**
   * Article ids this caller holds a live grant on.
   *
   * Bounded, and used to widen browse and search to exactly those articles —
   * so a granted document can be found, not only opened by direct link.
   */
  async grantedArticleIds(actor: Actor): Promise<string[]> {
    const now = new Date();
    const grants = await prisma.knowledgePermission.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [{ OR: [{ granteeUserId: actor.id }, { granteeRole: actor.role }] }],
      },
      select: { articleId: true },
      take: 500,
    });
    return [...new Set(grants.map((g) => g.articleId))];
  },

  async list(
    actor: Actor,
    filters: { category?: string; categoryId?: string; status?: string; take?: number } = {}
  ) {
    const take = Math.min(Math.max(filters.take ?? 30, 1), 100);
    const grantedIds = await this.grantedArticleIds(actor);
    return prisma.knowledgeArticle.findMany({
      where: {
        ...visibilityFilter(actor, { includeUnapproved: Boolean(filters.status), grantedIds }),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: ARTICLE_SUMMARY_SELECT,
    });
  },

  /** Articles by id, filtered by visibility. Used to re-check search hits. */
  async findVisibleByIds(
    actor: Actor,
    ids: readonly string[],
    options: { includeUnapproved?: boolean } = {}
  ) {
    if (ids.length === 0) return [];
    const grantedIds = await this.grantedArticleIds(actor);
    return prisma.knowledgeArticle.findMany({
      where: { id: { in: [...ids] }, ...visibilityFilter(actor, { ...options, grantedIds }) },
      select: { ...ARTICLE_SUMMARY_SELECT, body: true },
    });
  },

  create(data: Parameters<typeof prisma.knowledgeArticle.create>[0]["data"]) {
    return prisma.knowledgeArticle.create({ data });
  },

  update(id: string, data: Parameters<typeof prisma.knowledgeArticle.update>[0]["data"]) {
    return prisma.knowledgeArticle.update({ where: { id }, data });
  },

  /** Bumps the read counter without blocking the read that triggered it. */
  recordView(id: string): void {
    void prisma.knowledgeArticle
      .update({ where: { id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } })
      .catch(() => undefined);
  },

  slugExists(slug: string, exceptId?: string) {
    return prisma.knowledgeArticle.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
  },

  dueForReview(take = 50) {
    return prisma.knowledgeArticle.findMany({
      where: { status: "APPROVED", reviewDueAt: { lte: new Date() } },
      orderBy: { reviewDueAt: "asc" },
      take,
      select: ARTICLE_SUMMARY_SELECT,
    });
  },
};

export const versionRepository = {
  create(data: {
    articleId: string;
    version: number;
    title: string;
    summary: string;
    body: string;
    changeNote?: string | null;
    authoredById?: string | null;
  }) {
    return prisma.knowledgeVersion.create({ data });
  },

  listFor(articleId: string, take = 50) {
    return prisma.knowledgeVersion.findMany({
      where: { articleId },
      orderBy: { version: "desc" },
      take,
      select: {
        id: true,
        version: true,
        title: true,
        summary: true,
        changeNote: true,
        authoredById: true,
        createdAt: true,
      },
    });
  },

  at(articleId: string, version: number) {
    return prisma.knowledgeVersion.findUnique({
      where: { articleId_version: { articleId, version } },
    });
  },
};

export const reviewRepository = {
  create(data: { articleId: string; decision: string; reviewerId: string; notes?: string | null }) {
    return prisma.knowledgeReview.create({ data });
  },
  listFor(articleId: string) {
    return prisma.knowledgeReview.findMany({
      where: { articleId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },
};

export const permissionRepository = {
  /** Live grants on an article — expired and revoked rows excluded. */
  activeFor(articleId: string) {
    const now = new Date();
    return prisma.knowledgePermission.findMany({
      where: {
        articleId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  },

  grant(data: {
    articleId: string;
    granteeUserId?: string | null;
    granteeRole?: string | null;
    access?: string;
    grantedById?: string | null;
    expiresAt?: Date | null;
  }) {
    return prisma.knowledgePermission.create({ data });
  },

  revoke(id: string) {
    return prisma.knowledgePermission.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

export const categoryRepository = {
  list(activeOnly = true) {
    return prisma.knowledgeCategory.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
  },
  bySlug(slug: string) {
    return prisma.knowledgeCategory.findUnique({ where: { slug } });
  },
  byDomain(domain: string) {
    return prisma.knowledgeCategory.findFirst({ where: { domain, isActive: true } });
  },
  upsert(data: { slug: string; name: string; domain?: string | null; position?: number; description?: string | null }) {
    return prisma.knowledgeCategory.upsert({
      where: { slug: data.slug },
      create: data,
      update: { name: data.name, domain: data.domain ?? null, position: data.position ?? 0 },
    });
  },
};

export const tagRepository = {
  /** Attaches tags to an article, creating any that are new. */
  async syncFor(articleId: string, tags: readonly string[]): Promise<void> {
    const slugs = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 25);

    await prisma.knowledgeArticleTag.deleteMany({ where: { articleId } });
    if (slugs.length === 0) return;

    for (const slug of slugs) {
      const tag = await prisma.knowledgeTag.upsert({
        where: { slug },
        create: { slug, name: slug, usageCount: 1 },
        update: { usageCount: { increment: 1 } },
      });
      await prisma.knowledgeArticleTag.create({ data: { articleId, tagId: tag.id } });
    }
  },

  popular(take = 30) {
    return prisma.knowledgeTag.findMany({
      where: { usageCount: { gt: 0 } },
      orderBy: { usageCount: "desc" },
      take,
      select: { slug: true, name: true, usageCount: true },
    });
  },

  articlesFor(slug: string, take = 30) {
    return prisma.knowledgeArticleTag.findMany({
      where: { tag: { slug: slug.toLowerCase() } },
      take,
      select: { articleId: true },
    });
  },
};

export const searchIndexRepository = {
  /** Replaces an article's index entries wholesale. */
  async rebuildFor(
    entityId: string,
    entries: ReadonlyArray<{ term: string; field: string; frequency: number }>
  ): Promise<number> {
    await prisma.searchIndexEntry.deleteMany({
      where: { entityKind: "knowledgeArticle", entityId },
    });
    if (entries.length === 0) return 0;

    await prisma.searchIndexEntry.createMany({
      data: entries.map((e) => ({
        term: e.term,
        entityKind: "knowledgeArticle",
        entityId,
        field: e.field,
        frequency: e.frequency,
      })),
    });
    return entries.length;
  },

  async removeFor(entityId: string): Promise<void> {
    await prisma.searchIndexEntry.deleteMany({
      where: { entityKind: "knowledgeArticle", entityId },
    });
  },

  lookup(terms: readonly string[]) {
    if (terms.length === 0) return Promise.resolve([]);
    return prisma.searchIndexEntry.findMany({
      where: { entityKind: "knowledgeArticle", term: { in: [...terms] } },
      select: { term: true, entityId: true, field: true, frequency: true },
      // Bounded: a stop-word that slipped through must not pull the whole index
      // into memory.
      take: 5_000,
    });
  },

  /** How many indexed articles contain each term — the IDF denominator. */
  async documentFrequency(terms: readonly string[]): Promise<Map<string, number>> {
    if (terms.length === 0) return new Map();
    const rows = await prisma.searchIndexEntry.groupBy({
      by: ["term"],
      where: { entityKind: "knowledgeArticle", term: { in: [...terms] } },
      _count: { entityId: true },
    });
    return new Map(rows.map((r) => [r.term, r._count.entityId]));
  },

  totalIndexed() {
    return prisma.searchIndexEntry
      .findMany({
        where: { entityKind: "knowledgeArticle" },
        distinct: ["entityId"],
        select: { entityId: true },
        take: 10_000,
      })
      .then((rows) => rows.length);
  },
};

export const memoryRepository = {
  /** The live value of a key — superseded and expired rows excluded. */
  live(scope: MemoryScope, subjectId: string, key: string) {
    return prisma.memoryRecord.findFirst({
      where: {
        scope,
        subjectId,
        key,
        supersededAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
  },

  liveAll(
    scope: MemoryScope,
    subjectId: string,
    filters: { kind?: string; prefix?: string; take?: number } = {}
  ) {
    return prisma.memoryRecord.findMany({
      where: {
        scope,
        subjectId,
        supersededAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.prefix ? { key: { startsWith: filters.prefix } } : {}),
      },
      orderBy: { key: "asc" },
      take: Math.min(Math.max(filters.take ?? 200, 1), 500),
    });
  },

  create(data: Parameters<typeof prisma.memoryRecord.create>[0]["data"]) {
    return prisma.memoryRecord.create({ data });
  },

  supersede(id: string, byId: string) {
    return prisma.memoryRecord.update({
      where: { id },
      data: { supersededById: byId, supersededAt: new Date() },
    });
  },

  /** Every value a key has held, newest first — including superseded ones. */
  keyHistory(scope: MemoryScope, subjectId: string, key: string, take = 50) {
    return prisma.memoryRecord.findMany({
      where: { scope, subjectId, key },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  everything(scope: MemoryScope, subjectId: string, take = 1_000) {
    return prisma.memoryRecord.findMany({
      where: { scope, subjectId },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  forget(scope: MemoryScope, subjectId: string, key: string) {
    return prisma.memoryRecord.deleteMany({ where: { scope, subjectId, key } });
  },
};

export const conversationMemoryRepository = {
  forSession(sessionRef: string, options: { pinnedOnly?: boolean; take?: number } = {}) {
    return prisma.conversationMemory.findMany({
      where: {
        sessionRef,
        ...(options.pinnedOnly ? { pinned: true } : {}),
        // Pinned entries ignore expiry on read, exactly as they do in the
        // sweep. Honouring the pin in one place and not the other would leave a
        // pinned note undeleted but invisible — worse than deleting it, because
        // it still occupies the session and nobody can see why.
        OR: [{ pinned: true }, { expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
      take: Math.min(Math.max(options.take ?? 100, 1), 300),
    });
  },

  create(data: Parameters<typeof prisma.conversationMemory.create>[0]["data"]) {
    return prisma.conversationMemory.create({ data });
  },

  pin(id: string, pinned: boolean) {
    return prisma.conversationMemory.update({ where: { id }, data: { pinned } });
  },

  markPromoted(id: string, recordId: string) {
    return prisma.conversationMemory.update({
      where: { id },
      data: { retention: "PROMOTED", promotedRecordId: recordId },
    });
  },

  /** Removes expired, unpinned entries. Pinned entries never expire. */
  sweep() {
    return prisma.conversationMemory.deleteMany({
      where: { pinned: false, expiresAt: { lte: new Date() } },
    });
  },

  findById(id: string) {
    return prisma.conversationMemory.findUnique({ where: { id } });
  },
};
