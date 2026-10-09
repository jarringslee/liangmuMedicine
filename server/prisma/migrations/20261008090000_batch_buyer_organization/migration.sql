BEGIN;

-- 不回填旧批次；未指定收货组织的历史批次不能被任意采购商收货。
ALTER TABLE "HerbBatch" ADD COLUMN "buyerOrganizationId" TEXT;

CREATE INDEX "HerbBatch_buyerOrganizationId_stage_idx" ON "HerbBatch"("buyerOrganizationId", "stage");

ALTER TABLE "HerbBatch" ADD CONSTRAINT "HerbBatch_buyerOrganizationId_fkey"
FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
