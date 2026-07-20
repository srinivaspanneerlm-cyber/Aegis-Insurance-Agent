-- AlterTable
ALTER TABLE "UploadedDocument" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "UploadedDocument_ownerId_contentHash_idx" ON "UploadedDocument"("ownerId", "contentHash");
