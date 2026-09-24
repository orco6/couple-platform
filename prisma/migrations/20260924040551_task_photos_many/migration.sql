-- DropIndex
DROP INDEX "TaskPhoto_taskId_key";

-- CreateIndex
CREATE INDEX "TaskPhoto_taskId_createdAt_idx" ON "TaskPhoto"("taskId", "createdAt");
