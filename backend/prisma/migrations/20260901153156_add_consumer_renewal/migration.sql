-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "registrationNorm" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenewalLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "policyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "preferredChannel" TEXT NOT NULL,
    "urgencyAtCreation" TEXT NOT NULL,
    "expiryAtCreation" DATETIME,
    "consentId" TEXT,
    "assignedToId" TEXT,
    "closedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RenewalLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RenewalLead_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "HeldPolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RenewalLead_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "RenewalConsent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenewalConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" DATETIME,
    "policyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "RenewalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HeldPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "insurer" TEXT,
    "productName" TEXT,
    "policyNumber" TEXT,
    "sumInsured" REAL,
    "premium" REAL,
    "startDate" DATETIME,
    "renewalDate" DATETIME,
    "external" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT,
    "policyType" TEXT,
    "idv" REAL,
    "ncbPercent" INTEGER,
    "documentId" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UPLOADED',
    "verificationNote" TEXT,
    "policyNumberNorm" TEXT,
    "enteredVia" TEXT NOT NULL DEFAULT 'MANUAL',
    "deletedAt" DATETIME,
    "organizationId" TEXT,
    CONSTRAINT "HeldPolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HeldPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsuranceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HeldPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HeldPolicy" ("createdAt", "domain", "external", "id", "insurer", "notes", "organizationId", "policyNumber", "premium", "productName", "profileId", "renewalDate", "startDate", "status", "sumInsured", "updatedAt") SELECT "createdAt", "domain", "external", "id", "insurer", "notes", "organizationId", "policyNumber", "premium", "productName", "profileId", "renewalDate", "startDate", "status", "sumInsured", "updatedAt" FROM "HeldPolicy";
DROP TABLE "HeldPolicy";
ALTER TABLE "new_HeldPolicy" RENAME TO "HeldPolicy";
CREATE INDEX "HeldPolicy_organizationId_idx" ON "HeldPolicy"("organizationId");
CREATE INDEX "HeldPolicy_profileId_domain_idx" ON "HeldPolicy"("profileId", "domain");
CREATE INDEX "HeldPolicy_renewalDate_idx" ON "HeldPolicy"("renewalDate");
CREATE INDEX "HeldPolicy_status_idx" ON "HeldPolicy"("status");
CREATE INDEX "HeldPolicy_profileId_deletedAt_idx" ON "HeldPolicy"("profileId", "deletedAt");
CREATE INDEX "HeldPolicy_policyNumberNorm_idx" ON "HeldPolicy"("policyNumberNorm");
CREATE INDEX "HeldPolicy_vehicleId_idx" ON "HeldPolicy"("vehicleId");
CREATE INDEX "HeldPolicy_verificationState_idx" ON "HeldPolicy"("verificationState");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Vehicle_registrationNorm_idx" ON "Vehicle"("registrationNorm");

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_deletedAt_idx" ON "Vehicle"("ownerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_ownerId_registrationNorm_key" ON "Vehicle"("ownerId", "registrationNorm");

-- CreateIndex
CREATE INDEX "RenewalLead_status_createdAt_idx" ON "RenewalLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RenewalLead_userId_createdAt_idx" ON "RenewalLead"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RenewalLead_urgencyAtCreation_status_idx" ON "RenewalLead"("urgencyAtCreation", "status");

-- CreateIndex
CREATE INDEX "RenewalLead_assignedToId_idx" ON "RenewalLead"("assignedToId");

-- CreateIndex
CREATE INDEX "RenewalLead_deletedAt_idx" ON "RenewalLead"("deletedAt");

-- CreateIndex
CREATE INDEX "RenewalLead_createdAt_idx" ON "RenewalLead"("createdAt");

-- CreateIndex
CREATE INDEX "RenewalConsent_userId_purpose_withdrawnAt_idx" ON "RenewalConsent"("userId", "purpose", "withdrawnAt");

-- CreateIndex
CREATE INDEX "RenewalConsent_userId_channel_withdrawnAt_idx" ON "RenewalConsent"("userId", "channel", "withdrawnAt");

-- CreateIndex
CREATE INDEX "RenewalConsent_grantedAt_idx" ON "RenewalConsent"("grantedAt");
