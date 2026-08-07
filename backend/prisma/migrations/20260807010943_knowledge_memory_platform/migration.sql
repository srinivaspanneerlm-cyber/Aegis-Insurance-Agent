-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changeNote" TEXT,
    "authoredById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemoryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "sourceRef" TEXT,
    "expiresAt" DATETIME,
    "supersededById" TEXT,
    "supersededAt" DATETIME,
    "createdById" TEXT,
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
    "lastViewedAt" DATETIME
);
INSERT INTO "new_KnowledgeArticle" ("body", "category", "departments", "id", "publishedAt", "slug", "summary", "tags", "title", "updatedAt", "version") SELECT "body", "category", "departments", "id", "publishedAt", "slug", "summary", "tags", "title", "updatedAt", "version" FROM "KnowledgeArticle";
DROP TABLE "KnowledgeArticle";
ALTER TABLE "new_KnowledgeArticle" RENAME TO "KnowledgeArticle";
CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");
CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");
CREATE INDEX "KnowledgeArticle_publishedAt_idx" ON "KnowledgeArticle"("publishedAt");
CREATE INDEX "KnowledgeArticle_status_category_idx" ON "KnowledgeArticle"("status", "category");
CREATE INDEX "KnowledgeArticle_classification_status_idx" ON "KnowledgeArticle"("classification", "status");
CREATE INDEX "KnowledgeArticle_reviewDueAt_idx" ON "KnowledgeArticle"("reviewDueAt");
CREATE INDEX "KnowledgeArticle_effectiveFrom_effectiveTo_idx" ON "KnowledgeArticle"("effectiveFrom", "effectiveTo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KnowledgeVersion_articleId_createdAt_idx" ON "KnowledgeVersion"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_articleId_version_key" ON "KnowledgeVersion"("articleId", "version");

-- CreateIndex
CREATE INDEX "KnowledgeReview_articleId_createdAt_idx" ON "KnowledgeReview"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeReview_reviewerId_idx" ON "KnowledgeReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRecord_supersededById_key" ON "MemoryRecord"("supersededById");

-- CreateIndex
CREATE INDEX "MemoryRecord_scope_subjectId_key_idx" ON "MemoryRecord"("scope", "subjectId", "key");

-- CreateIndex
CREATE INDEX "MemoryRecord_scope_subjectId_kind_idx" ON "MemoryRecord"("scope", "subjectId", "kind");

-- CreateIndex
CREATE INDEX "MemoryRecord_expiresAt_idx" ON "MemoryRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_supersededAt_idx" ON "MemoryRecord"("supersededAt");
