-- SAMPLE DOMAIN (service business). Delete this migration together with
-- prisma/schema/domain.prisma when starting a real project.

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "dueDate" DATE,
    "completedOn" DATE,
    "priceAgorot" INTEGER,
    "vatRateBps" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_ownerId_archivedAt_idx" ON "Customer"("ownerId", "archivedAt");

-- CreateIndex
CREATE INDEX "Customer_archivedAt_name_idx" ON "Customer"("archivedAt", "name");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_archivedAt_idx" ON "Task"("assigneeId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_customerId_archivedAt_idx" ON "Task"("customerId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_completedOn_idx" ON "Task"("completedOn");

-- CreateIndex
CREATE INDEX "Task_dueDate_status_idx" ON "Task"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Note_customerId_deletedAt_createdAt_idx" ON "Note"("customerId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sample-domain invariants: the server validates these too; the database is
-- the last line of defence against a future code path that forgets.
ALTER TABLE "Task" ADD CONSTRAINT "Task_price_non_negative" CHECK ("priceAgorot" IS NULL OR "priceAgorot" >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "Task_vat_rate_range" CHECK ("vatRateBps" IS NULL OR "vatRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "Task" ADD CONSTRAINT "Task_price_has_rate" CHECK (("priceAgorot" IS NULL) = ("vatRateBps" IS NULL));
ALTER TABLE "Task" ADD CONSTRAINT "Task_done_has_completion_date" CHECK (("status" = 'DONE') = ("completedOn" IS NOT NULL));
