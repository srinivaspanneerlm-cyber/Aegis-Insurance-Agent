-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "domain" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KnowledgeArticleTag" (
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("articleId", "tagId"),
    CONSTRAINT "KnowledgeArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "granteeUserId" TEXT,
    "granteeRole" TEXT,
    "access" TEXT NOT NULL DEFAULT 'READ',
    "grantedById" TEXT,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "KnowledgePermission_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchIndexEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "entityKind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "field" TEXT NOT NULL DEFAULT 'body',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionRef" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "retention" TEXT NOT NULL DEFAULT 'SESSION',
    "promotedRecordId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT,
    "departments" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "sourceRef" TEXT,
    "sourceKind" TEXT,
    "authorId" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "reviewDueAt" DATETIME,
    "archivedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "categoryId" TEXT,
    CONSTRAINT "KnowledgeArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeArticle" ("approvedAt", "approvedById", "archivedAt", "authorId", "body", "category", "classification", "departments", "effectiveFrom", "effectiveTo", "id", "lastViewedAt", "publishedAt", "reviewDueAt", "slug", "sourceKind", "sourceRef", "status", "summary", "tags", "title", "updatedAt", "version", "viewCount") SELECT "approvedAt", "approvedById", "archivedAt", "authorId", "body", "category", "classification", "departments", "effectiveFrom", "effectiveTo", "id", "lastViewedAt", "publishedAt", "reviewDueAt", "slug", "sourceKind", "sourceRef", "status", "summary", "tags", "title", "updatedAt", "version", "viewCount" FROM "KnowledgeArticle";
DROP TABLE "KnowledgeArticle";
ALTER TABLE "new_KnowledgeArticle" RENAME TO "KnowledgeArticle";
CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");
CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");
CREATE INDEX "KnowledgeArticle_publishedAt_idx" ON "KnowledgeArticle"("publishedAt");
CREATE INDEX "KnowledgeArticle_status_category_idx" ON "KnowledgeArticle"("status", "category");
CREATE INDEX "KnowledgeArticle_classification_status_idx" ON "KnowledgeArticle"("classification", "status");
CREATE INDEX "KnowledgeArticle_reviewDueAt_idx" ON "KnowledgeArticle"("reviewDueAt");
CREATE INDEX "KnowledgeArticle_effectiveFrom_effectiveTo_idx" ON "KnowledgeArticle"("effectiveFrom", "effectiveTo");
CREATE INDEX "KnowledgeArticle_categoryId_status_idx" ON "KnowledgeArticle"("categoryId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCategory_slug_key" ON "KnowledgeCategory"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeCategory_parentId_idx" ON "KnowledgeCategory"("parentId");

-- CreateIndex
CREATE INDEX "KnowledgeCategory_domain_idx" ON "KnowledgeCategory"("domain");

-- CreateIndex
CREATE INDEX "KnowledgeCategory_isActive_position_idx" ON "KnowledgeCategory"("isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_slug_key" ON "KnowledgeTag"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeTag_usageCount_idx" ON "KnowledgeTag"("usageCount");

-- CreateIndex
CREATE INDEX "KnowledgeArticleTag_tagId_idx" ON "KnowledgeArticleTag"("tagId");

-- CreateIndex
CREATE INDEX "KnowledgePermission_articleId_revokedAt_idx" ON "KnowledgePermission"("articleId", "revokedAt");

-- CreateIndex
CREATE INDEX "KnowledgePermission_granteeUserId_idx" ON "KnowledgePermission"("granteeUserId");

-- CreateIndex
CREATE INDEX "KnowledgePermission_granteeRole_idx" ON "KnowledgePermission"("granteeRole");

-- CreateIndex
CREATE INDEX "SearchIndexEntry_term_idx" ON "SearchIndexEntry"("term");

-- CreateIndex
CREATE INDEX "SearchIndexEntry_entityKind_entityId_idx" ON "SearchIndexEntry"("entityKind", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndexEntry_term_entityKind_entityId_field_key" ON "SearchIndexEntry"("term", "entityKind", "entityId", "field");

-- CreateIndex
CREATE INDEX "ConversationMemory_sessionRef_createdAt_idx" ON "ConversationMemory"("sessionRef", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMemory_userId_createdAt_idx" ON "ConversationMemory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMemory_expiresAt_idx" ON "ConversationMemory"("expiresAt");

-- CreateIndex
CREATE INDEX "ConversationMemory_sessionRef_pinned_idx" ON "ConversationMemory"("sessionRef", "pinned");
