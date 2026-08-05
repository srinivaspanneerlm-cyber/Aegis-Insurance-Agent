-- CreateTable
CREATE TABLE "LinkedIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME,
    CONSTRAINT "LinkedIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LinkedIdentity_userId_idx" ON "LinkedIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedIdentity_provider_subject_key" ON "LinkedIdentity"("provider", "subject");

-- Backfill: adopt every account that was already linked to Google.
--
-- Without this, an existing Google customer would come back, find no linked
-- identity, and be matched on their verified email instead — which works, but
-- silently re-links them and loses the original link date. Worse, an account
-- whose email had since changed at Google would not match at all, and the
-- customer would be locked out of their own policies.
--
-- The id is derived from the user id rather than random so that re-running this
-- statement cannot produce a second row for the same person.
INSERT INTO "LinkedIdentity" ("id", "userId", "provider", "subject", "email", "linkedAt")
SELECT 'legacy-google-' || "id", "id", 'google', "googleId", "email", CURRENT_TIMESTAMP
FROM "User"
WHERE "googleId" IS NOT NULL;
