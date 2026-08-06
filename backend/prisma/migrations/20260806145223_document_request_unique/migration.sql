-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_DocumentRequest" ("createdAt", "description", "documentKey", "domain", "fulfilledAt", "fulfilledById", "id", "label", "reason", "requestedBy", "required", "status", "subjectId", "updatedAt", "workItemId") SELECT "createdAt", "description", "documentKey", "domain", "fulfilledAt", "fulfilledById", "id", "label", "reason", "requestedBy", "required", "status", "subjectId", "updatedAt", coalesce("workItemId", '') AS "workItemId" FROM "DocumentRequest";
DROP TABLE "DocumentRequest";
ALTER TABLE "new_DocumentRequest" RENAME TO "DocumentRequest";
CREATE INDEX "DocumentRequest_subjectId_status_idx" ON "DocumentRequest"("subjectId", "status");
CREATE INDEX "DocumentRequest_workItemId_idx" ON "DocumentRequest"("workItemId");
CREATE UNIQUE INDEX "DocumentRequest_subjectId_workItemId_documentKey_key" ON "DocumentRequest"("subjectId", "workItemId", "documentKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
