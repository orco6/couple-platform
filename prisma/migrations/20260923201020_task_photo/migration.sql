-- CreateTable
CREATE TABLE "TaskPhoto" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskPhoto_taskId_key" ON "TaskPhoto"("taskId");

-- AddForeignKey
ALTER TABLE "TaskPhoto" ADD CONSTRAINT "TaskPhoto_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
