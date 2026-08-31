-- The project has not seeded business data yet. This migration intentionally
-- replaces the first schema draft before the real API and seed are introduced.

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('platform', 'grower', 'processor', 'buyer');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "HerbCategory" AS ENUM ('root', 'wholeHerb', 'fruitSeed', 'flowerLeaf', 'bark', 'mineral', 'other');

-- CreateEnum
CREATE TYPE "AuditDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('manual', 'aiAssisted');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('batchSubmitted', 'auditResult', 'stageChanged', 'qcReportUploaded', 'system');

-- DropForeignKey
ALTER TABLE "HerbBatch" DROP CONSTRAINT "HerbBatch_createdById_fkey";

-- DropForeignKey
ALTER TABLE "HerbBatch" DROP CONSTRAINT "HerbBatch_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropIndex
DROP INDEX "BatchEvent_batchId_idx";

-- DropIndex
DROP INDEX "BatchEvent_occurredAt_idx";

-- DropIndex
DROP INDEX "HerbBatch_auditStatus_idx";

-- DropIndex
DROP INDEX "HerbBatch_organizationId_idx";

-- DropIndex
DROP INDEX "Organization_type_idx";

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "BatchEvent" DROP COLUMN "attachments",
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "visibleRoles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[];

-- AlterTable
ALTER TABLE "HerbBatch" DROP COLUMN "growerName",
DROP COLUMN "organizationId",
ADD COLUMN     "growerOrganizationId" TEXT NOT NULL,
ADD COLUMN     "processorOrganizationId" TEXT,
ADD COLUMN     "requiresProcessing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "category",
ADD COLUMN     "category" "HerbCategory" NOT NULL,
ALTER COLUMN "plantingStartDate" SET DATA TYPE DATE,
ALTER COLUMN "createdById" SET NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "type",
ADD COLUMN     "type" "OrganizationType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- DropTable
DROP TABLE "Message";

-- DropEnum
DROP TYPE "MessageChannel";

-- CreateTable
CREATE TABLE "BatchAudit" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "decision" "AuditDecision" NOT NULL,
    "source" "AuditSource" NOT NULL DEFAULT 'manual',
    "riskLevel" "RiskLevel" NOT NULL,
    "reason" TEXT,
    "evidence" JSONB,
    "modelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "eventId" TEXT,
    "uploadedById" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "batchId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchAudit_batchId_createdAt_idx" ON "BatchAudit"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "BatchAudit_reviewerId_idx" ON "BatchAudit"("reviewerId");

-- CreateIndex
CREATE INDEX "BatchAudit_decision_idx" ON "BatchAudit"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_batchId_idx" ON "Attachment"("batchId");

-- CreateIndex
CREATE INDEX "Attachment_eventId_idx" ON "Attachment"("eventId");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_batchId_idx" ON "Notification"("batchId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "BatchEvent_batchId_occurredAt_idx" ON "BatchEvent"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "HerbBatch_auditStatus_riskLevel_idx" ON "HerbBatch"("auditStatus", "riskLevel");

-- CreateIndex
CREATE INDEX "HerbBatch_growerOrganizationId_auditStatus_idx" ON "HerbBatch"("growerOrganizationId", "auditStatus");

-- CreateIndex
CREATE INDEX "HerbBatch_processorOrganizationId_stage_idx" ON "HerbBatch"("processorOrganizationId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Organization_type_enabled_idx" ON "Organization"("type", "enabled");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- AddForeignKey
ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_growerOrganizationId_fkey" FOREIGN KEY ("growerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_processorOrganizationId_fkey" FOREIGN KEY ("processorOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchAudit" ADD CONSTRAINT "BatchAudit_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HerbBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchAudit" ADD CONSTRAINT "BatchAudit_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HerbBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BatchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HerbBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
