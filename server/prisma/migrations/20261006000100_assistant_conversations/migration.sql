-- 仅新增 AI 会话与消息，不修改业务 seed 或删除现有数据；尚未执行。
CREATE TYPE "AssistantTurnStatus" AS ENUM ('pending', 'done', 'error', 'stopped');
CREATE TABLE "AssistantConversation" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "runningRequestId" TEXT, "runningUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssistantTurn" (
  "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL, "question" TEXT NOT NULL, "requestedIdentifier" TEXT,
  "actorRole" "UserRole" NOT NULL, "actorOrganizationId" TEXT,
  "batchId" TEXT, "batchVersion" INTEGER, "batchLabel" JSONB,
  "status" "AssistantTurnStatus" NOT NULL DEFAULT 'pending', "reply" JSONB, "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantTurn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssistantConversation_userId_key" ON "AssistantConversation"("userId");
CREATE UNIQUE INDEX "AssistantTurn_conversationId_requestId_key" ON "AssistantTurn"("conversationId", "requestId");
CREATE UNIQUE INDEX "AssistantTurn_conversationId_sequence_key" ON "AssistantTurn"("conversationId", "sequence");
CREATE INDEX "AssistantTurn_batchId_idx" ON "AssistantTurn"("batchId");
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantTurn" ADD CONSTRAINT "AssistantTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantTurn" ADD CONSTRAINT "AssistantTurn_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HerbBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
