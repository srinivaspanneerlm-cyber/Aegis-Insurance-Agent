-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "deviceLabel" TEXT,
    "trustedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokedReason" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "realm" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RefreshToken" ("createdAt", "expiresAt", "id", "revokedAt", "tokenHash", "userId") SELECT "createdAt", "expiresAt", "id", "revokedAt", "tokenHash", "userId" FROM "RefreshToken";
DROP TABLE "RefreshToken";
ALTER TABLE "new_RefreshToken" RENAME TO "RefreshToken";
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "realm" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "googleId" TEXT,
    "image" TEXT,
    "lastLoginAt" DATETIME,
    "emailVerifiedAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "mfaEnrolledAt" DATETIME,
    "mfaMethod" TEXT,
    "onboardedAt" DATETIME,
    "preferredLanguage" TEXT,
    "insuranceInterests" TEXT
);
INSERT INTO "new_User" ("createdAt", "deletedAt", "email", "googleId", "id", "image", "insuranceInterests", "isActive", "lastLoginAt", "name", "onboardedAt", "password", "preferredLanguage", "role", "updatedAt", "version") SELECT "createdAt", "deletedAt", "email", "googleId", "id", "image", "insuranceInterests", "isActive", "lastLoginAt", "name", "onboardedAt", "password", "preferredLanguage", "role", "updatedAt", "version" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_realm_idx" ON "User"("realm");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_lastSeenAt_idx" ON "AuthSession"("userId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_idx" ON "VerificationToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: one role vocabulary, and a realm for every account.
--
-- The table rebuild above copied `role` across verbatim, so every existing row
-- still holds the old lower-case spelling while new rows default to the new
-- one. Left alone that is precisely the split this migration exists to end —
-- two spellings both legal, and every lookup obliged to know about both.
--
-- The mapping is the honest reading of what those roles were used for:
--   customer   → CUSTOMER        an individual buying cover
--   admin      → EMPLOYEE        staff working the pipeline day to day
--   superadmin → PLATFORM_ADMIN  full platform authority
--
-- ENTERPRISE_ADMIN has no source rows because nothing granted that authority
-- before; inventing holders for it would be worse than an empty set.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "User" SET "role" = 'CUSTOMER'       WHERE "role" = 'customer';
UPDATE "User" SET "role" = 'EMPLOYEE'       WHERE "role" = 'admin';
UPDATE "User" SET "role" = 'PLATFORM_ADMIN' WHERE "role" = 'superadmin';

-- Realm follows from the role, because until now the role was the only thing
-- carrying that meaning. From here they move independently.
UPDATE "User" SET "realm" = 'CUSTOMER'   WHERE "role" = 'CUSTOMER';
UPDATE "User" SET "realm" = 'EMPLOYEE'   WHERE "role" = 'EMPLOYEE';
UPDATE "User" SET "realm" = 'ENTERPRISE' WHERE "role" = 'ENTERPRISE_ADMIN';
UPDATE "User" SET "realm" = 'PLATFORM'   WHERE "role" = 'PLATFORM_ADMIN';

-- An account that signed in through an identity provider had its address
-- verified by that provider before we ever created the account — `verify()`
-- refuses an unverified one. Marking those as verified reflects what already
-- happened; leaving them null would send a returning Google customer to an
-- email-verification screen for an address Google vouched for.
UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL
  AND "id" IN (SELECT DISTINCT "userId" FROM "LinkedIdentity");
