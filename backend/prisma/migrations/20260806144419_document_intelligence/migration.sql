-- CreateTable
CREATE TABLE "DocumentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "workItemId" TEXT,
    "domain" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "fulfilledById" TEXT,
    "fulfilledAt" DATETIME,
    "requestedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRequest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UploadedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "ownerId" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "contentHash" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "category" TEXT,
    "documentKey" TEXT,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "verifiedAt" DATETIME,
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "replacedById" TEXT,
    "extractedData" TEXT,
    "riskScore" REAL,
    "riskReason" TEXT,
    CONSTRAINT "UploadedDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UploadedDocument" ("contentHash", "deletedAt", "filename", "filepath", "id", "mimeType", "ownerId", "sizeBytes", "updatedAt", "uploadedAt") SELECT "contentHash", "deletedAt", "filename", "filepath", "id", "mimeType", "ownerId", "sizeBytes", "updatedAt", "uploadedAt" FROM "UploadedDocument";
DROP TABLE "UploadedDocument";
ALTER TABLE "new_UploadedDocument" RENAME TO "UploadedDocument";
CREATE INDEX "UploadedDocument_ownerId_idx" ON "UploadedDocument"("ownerId");
CREATE INDEX "UploadedDocument_deletedAt_idx" ON "UploadedDocument"("deletedAt");
CREATE INDEX "UploadedDocument_uploadedAt_idx" ON "UploadedDocument"("uploadedAt");
CREATE INDEX "UploadedDocument_ownerId_contentHash_idx" ON "UploadedDocument"("ownerId", "contentHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DocumentEvent_documentId_createdAt_idx" ON "DocumentEvent"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentEvent_stage_idx" ON "DocumentEvent"("stage");

-- CreateIndex
CREATE INDEX "DocumentRequest_subjectId_status_idx" ON "DocumentRequest"("subjectId", "status");

-- CreateIndex
CREATE INDEX "DocumentRequest_workItemId_idx" ON "DocumentRequest"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_subjectId_workItemId_documentKey_key" ON "DocumentRequest"("subjectId", "workItemId", "documentKey");
