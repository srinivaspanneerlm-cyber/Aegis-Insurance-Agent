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
    "organizationId" TEXT,
    CONSTRAINT "DocumentRequest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentRequest" ("createdAt", "description", "documentKey", "domain", "fulfilledAt", "fulfilledById", "id", "label", "reason", "requestedBy", "required", "status", "subjectId", "updatedAt", "workItemId") SELECT "createdAt", "description", "documentKey", "domain", "fulfilledAt", "fulfilledById", "id", "label", "reason", "requestedBy", "required", "status", "subjectId", "updatedAt", "workItemId" FROM "DocumentRequest";
DROP TABLE "DocumentRequest";
ALTER TABLE "new_DocumentRequest" RENAME TO "DocumentRequest";
CREATE INDEX "DocumentRequest_organizationId_idx" ON "DocumentRequest"("organizationId");
CREATE INDEX "DocumentRequest_subjectId_status_idx" ON "DocumentRequest"("subjectId", "status");
CREATE INDEX "DocumentRequest_workItemId_idx" ON "DocumentRequest"("workItemId");
CREATE UNIQUE INDEX "DocumentRequest_subjectId_workItemId_documentKey_key" ON "DocumentRequest"("subjectId", "workItemId", "documentKey");
CREATE TABLE "new_EmployeeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "managerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" DATETIME,
    "workloadLimit" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "EmployeeProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmployeeProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeProfile" ("branch", "createdAt", "department", "designation", "employeeCode", "exitedAt", "id", "joinedAt", "managerId", "status", "updatedAt", "userId", "workloadLimit") SELECT "branch", "createdAt", "department", "designation", "employeeCode", "exitedAt", "id", "joinedAt", "managerId", "status", "updatedAt", "userId", "workloadLimit" FROM "EmployeeProfile";
DROP TABLE "EmployeeProfile";
ALTER TABLE "new_EmployeeProfile" RENAME TO "EmployeeProfile";
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");
CREATE UNIQUE INDEX "EmployeeProfile_employeeCode_key" ON "EmployeeProfile"("employeeCode");
CREATE INDEX "EmployeeProfile_organizationId_idx" ON "EmployeeProfile"("organizationId");
CREATE INDEX "EmployeeProfile_department_status_idx" ON "EmployeeProfile"("department", "status");
CREATE INDEX "EmployeeProfile_branch_idx" ON "EmployeeProfile"("branch");
CREATE INDEX "EmployeeProfile_managerId_idx" ON "EmployeeProfile"("managerId");
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
    "organizationId" TEXT,
    CONSTRAINT "HeldPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsuranceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HeldPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HeldPolicy" ("createdAt", "domain", "external", "id", "insurer", "notes", "policyNumber", "premium", "productName", "profileId", "renewalDate", "startDate", "status", "sumInsured", "updatedAt") SELECT "createdAt", "domain", "external", "id", "insurer", "notes", "policyNumber", "premium", "productName", "profileId", "renewalDate", "startDate", "status", "sumInsured", "updatedAt" FROM "HeldPolicy";
DROP TABLE "HeldPolicy";
ALTER TABLE "new_HeldPolicy" RENAME TO "HeldPolicy";
CREATE INDEX "HeldPolicy_organizationId_idx" ON "HeldPolicy"("organizationId");
CREATE INDEX "HeldPolicy_profileId_domain_idx" ON "HeldPolicy"("profileId", "domain");
CREATE INDEX "HeldPolicy_renewalDate_idx" ON "HeldPolicy"("renewalDate");
CREATE INDEX "HeldPolicy_status_idx" ON "HeldPolicy"("status");
CREATE TABLE "new_InsuranceProfile" (
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
    "organizationId" TEXT,
    CONSTRAINT "InsuranceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InsuranceProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InsuranceProfile" ("age", "city", "completeness", "createdAt", "dependents", "familyMembers", "financialGoals", "healthConditions", "id", "incomeRange", "insuranceHistory", "maritalStatus", "occupation", "parentsDependent", "profileHash", "propertyOwnership", "riskPreference", "smoker", "source", "state", "travelFrequency", "updatedAt", "userId", "vehicleOwnership") SELECT "age", "city", "completeness", "createdAt", "dependents", "familyMembers", "financialGoals", "healthConditions", "id", "incomeRange", "insuranceHistory", "maritalStatus", "occupation", "parentsDependent", "profileHash", "propertyOwnership", "riskPreference", "smoker", "source", "state", "travelFrequency", "updatedAt", "userId", "vehicleOwnership" FROM "InsuranceProfile";
DROP TABLE "InsuranceProfile";
ALTER TABLE "new_InsuranceProfile" RENAME TO "InsuranceProfile";
CREATE UNIQUE INDEX "InsuranceProfile_userId_key" ON "InsuranceProfile"("userId");
CREATE INDEX "InsuranceProfile_organizationId_idx" ON "InsuranceProfile"("organizationId");
CREATE INDEX "InsuranceProfile_updatedAt_idx" ON "InsuranceProfile"("updatedAt");
CREATE INDEX "InsuranceProfile_profileHash_idx" ON "InsuranceProfile"("profileHash");
CREATE TABLE "new_IntelligenceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "confidence" REAL,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    CONSTRAINT "IntelligenceRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsuranceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IntelligenceRun" ("confidence", "createdAt", "engineVersion", "id", "kind", "payload", "profileHash", "profileId", "userId") SELECT "confidence", "createdAt", "engineVersion", "id", "kind", "payload", "profileHash", "profileId", "userId" FROM "IntelligenceRun";
DROP TABLE "IntelligenceRun";
ALTER TABLE "new_IntelligenceRun" RENAME TO "IntelligenceRun";
CREATE INDEX "IntelligenceRun_organizationId_idx" ON "IntelligenceRun"("organizationId");
CREATE INDEX "IntelligenceRun_profileId_kind_createdAt_idx" ON "IntelligenceRun"("profileId", "kind", "createdAt");
CREATE INDEX "IntelligenceRun_userId_createdAt_idx" ON "IntelligenceRun"("userId", "createdAt");
CREATE INDEX "IntelligenceRun_profileHash_idx" ON "IntelligenceRun"("profileHash");
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "organizationId" TEXT,
    CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("assignedToId", "budget", "createdAt", "customerName", "deletedAt", "email", "id", "insuranceType", "phone", "status", "updatedAt", "version") SELECT "assignedToId", "budget", "createdAt", "customerName", "deletedAt", "email", "id", "insuranceType", "phone", "status", "updatedAt", "version" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE TABLE "new_Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyName" TEXT NOT NULL,
    "premium" REAL NOT NULL,
    "coverage" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "organizationId" TEXT,
    CONSTRAINT "Policy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Policy" ("companyId", "coverage", "createdAt", "deletedAt", "id", "isActive", "policyName", "premium", "updatedAt", "version") SELECT "companyId", "coverage", "createdAt", "deletedAt", "id", "isActive", "policyName", "premium", "updatedAt", "version" FROM "Policy";
DROP TABLE "Policy";
ALTER TABLE "new_Policy" RENAME TO "Policy";
CREATE INDEX "Policy_organizationId_idx" ON "Policy"("organizationId");
CREATE INDEX "Policy_companyId_idx" ON "Policy"("companyId");
CREATE INDEX "Policy_policyName_idx" ON "Policy"("policyName");
CREATE INDEX "Policy_deletedAt_idx" ON "Policy"("deletedAt");
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
    "organizationId" TEXT,
    CONSTRAINT "UploadedDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UploadedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UploadedDocument" ("category", "contentHash", "deletedAt", "documentKey", "domain", "extractedData", "filename", "filepath", "id", "mimeType", "ownerId", "rejectionReason", "replacedById", "riskReason", "riskScore", "sizeBytes", "status", "updatedAt", "uploadedAt", "verifiedAt", "verifiedById") SELECT "category", "contentHash", "deletedAt", "documentKey", "domain", "extractedData", "filename", "filepath", "id", "mimeType", "ownerId", "rejectionReason", "replacedById", "riskReason", "riskScore", "sizeBytes", "status", "updatedAt", "uploadedAt", "verifiedAt", "verifiedById" FROM "UploadedDocument";
DROP TABLE "UploadedDocument";
ALTER TABLE "new_UploadedDocument" RENAME TO "UploadedDocument";
CREATE INDEX "UploadedDocument_organizationId_idx" ON "UploadedDocument"("organizationId");
CREATE INDEX "UploadedDocument_ownerId_idx" ON "UploadedDocument"("ownerId");
CREATE INDEX "UploadedDocument_deletedAt_idx" ON "UploadedDocument"("deletedAt");
CREATE INDEX "UploadedDocument_uploadedAt_idx" ON "UploadedDocument"("uploadedAt");
CREATE INDEX "UploadedDocument_ownerId_contentHash_idx" ON "UploadedDocument"("ownerId", "contentHash");
CREATE TABLE "new_WorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "customerId" TEXT,
    "dueAt" DATETIME,
    "slaMinutes" INTEGER,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTouchAt" DATETIME,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "originRationale" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "EmployeeProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkItem" ("assigneeId", "closedAt", "createdAt", "customerId", "department", "dueAt", "firstTouchAt", "id", "kind", "openedAt", "origin", "originRationale", "priority", "reference", "resolvedAt", "slaMinutes", "status", "summary", "title", "updatedAt") SELECT "assigneeId", "closedAt", "createdAt", "customerId", "department", "dueAt", "firstTouchAt", "id", "kind", "openedAt", "origin", "originRationale", "priority", "reference", "resolvedAt", "slaMinutes", "status", "summary", "title", "updatedAt" FROM "WorkItem";
DROP TABLE "WorkItem";
ALTER TABLE "new_WorkItem" RENAME TO "WorkItem";
CREATE UNIQUE INDEX "WorkItem_reference_key" ON "WorkItem"("reference");
CREATE INDEX "WorkItem_organizationId_idx" ON "WorkItem"("organizationId");
CREATE INDEX "WorkItem_assigneeId_status_dueAt_idx" ON "WorkItem"("assigneeId", "status", "dueAt");
CREATE INDEX "WorkItem_status_priority_idx" ON "WorkItem"("status", "priority");
CREATE INDEX "WorkItem_kind_status_idx" ON "WorkItem"("kind", "status");
CREATE INDEX "WorkItem_customerId_idx" ON "WorkItem"("customerId");
CREATE INDEX "WorkItem_openedAt_idx" ON "WorkItem"("openedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
