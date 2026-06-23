-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'grower', 'processor', 'buyer');

-- CreateEnum
CREATE TYPE "BatchStage" AS ENUM ('planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('normal', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "BatchEventType" AS ENUM ('create', 'audit', 'stageChange', 'qcReport', 'storage', 'transport', 'transaction', 'note');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('system', 'email', 'chat');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HerbBatch" (
    "id" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "traceCode" TEXT NOT NULL,
    "herbName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "growerName" TEXT NOT NULL,
    "plantingStartDate" TIMESTAMP(3) NOT NULL,
    "origin" JSONB NOT NULL,
    "environment" TEXT,
    "coverImageUrl" TEXT,
    "description" TEXT,
    "stage" "BatchStage" NOT NULL DEFAULT 'planting',
    "auditStatus" "AuditStatus" NOT NULL DEFAULT 'pending',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'normal',
    "organizationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HerbBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "BatchEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "operatorId" TEXT,
    "operatorName" TEXT,
    "operatorRole" "UserRole",
    "fromStage" "BatchStage",
    "toStage" "BatchStage",
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT,
    "preview" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HerbBatch_batchNo_key" ON "HerbBatch"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "HerbBatch_traceCode_key" ON "HerbBatch"("traceCode");

-- CreateIndex
CREATE INDEX "HerbBatch_stage_idx" ON "HerbBatch"("stage");

-- CreateIndex
CREATE INDEX "HerbBatch_auditStatus_idx" ON "HerbBatch"("auditStatus");

-- CreateIndex
CREATE INDEX "HerbBatch_organizationId_idx" ON "HerbBatch"("organizationId");

-- CreateIndex
CREATE INDEX "HerbBatch_createdById_idx" ON "HerbBatch"("createdById");

-- CreateIndex
CREATE INDEX "BatchEvent_batchId_idx" ON "BatchEvent"("batchId");

-- CreateIndex
CREATE INDEX "BatchEvent_type_idx" ON "BatchEvent"("type");

-- CreateIndex
CREATE INDEX "BatchEvent_operatorId_idx" ON "BatchEvent"("operatorId");

-- CreateIndex
CREATE INDEX "BatchEvent_occurredAt_idx" ON "BatchEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "Message_channel_idx" ON "Message"("channel");

-- CreateIndex
CREATE INDEX "Message_receiverId_read_idx" ON "Message"("receiverId", "read");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HerbBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
