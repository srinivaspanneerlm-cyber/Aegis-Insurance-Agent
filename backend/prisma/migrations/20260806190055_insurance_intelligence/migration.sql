-- CreateTable
CREATE TABLE "InsuranceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "occupation" TEXT,
    "incomeRange" TEXT,
    "city" TEXT,
    "state" TEXT,
    "maritalStatus" TEXT,
    "familyMembers" INTEGER,
    "dependents" INTEGER,
    "parentsDependent" BOOLEAN,
    "vehicleOwnership" TEXT,
    "propertyOwnership" TEXT,
    "travelFrequency" TEXT,
    "healthConditions" TEXT,
    "smoker" BOOLEAN,
    "financialGoals" TEXT,
    "riskPreference" TEXT,
    "insuranceHistory" TEXT,
    "profileHash" TEXT,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsuranceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeldPolicy" (
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
    CONSTRAINT "HeldPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsuranceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "confidence" REAL,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsuranceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceProfile_userId_key" ON "InsuranceProfile"("userId");

-- CreateIndex
CREATE INDEX "InsuranceProfile_updatedAt_idx" ON "InsuranceProfile"("updatedAt");

-- CreateIndex
CREATE INDEX "InsuranceProfile_profileHash_idx" ON "InsuranceProfile"("profileHash");

-- CreateIndex
CREATE INDEX "HeldPolicy_profileId_domain_idx" ON "HeldPolicy"("profileId", "domain");

-- CreateIndex
CREATE INDEX "HeldPolicy_renewalDate_idx" ON "HeldPolicy"("renewalDate");

-- CreateIndex
CREATE INDEX "HeldPolicy_status_idx" ON "HeldPolicy"("status");

-- CreateIndex
CREATE INDEX "IntelligenceRun_profileId_kind_createdAt_idx" ON "IntelligenceRun"("profileId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceRun_userId_createdAt_idx" ON "IntelligenceRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceRun_profileHash_idx" ON "IntelligenceRun"("profileHash");
