-- CreateEnum
CREATE TYPE "TaskFor" AS ENUM ('ME', 'PARTNER', 'BOTH');

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "forWhom" "TaskFor" NOT NULL,
    "taskDate" DATE NOT NULL,
    "dueTime" TIMESTAMP(3),
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archiveReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayEntry" (
    "id" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "partnerId" TEXT NOT NULL,
    "executionRating" INTEGER NOT NULL,
    "respectRating" INTEGER NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTask_taskDate_archivedAt_idx" ON "DailyTask"("taskDate", "archivedAt");

-- CreateIndex
CREATE INDEX "DailyTask_completedById_idx" ON "DailyTask"("completedById");

-- CreateIndex
CREATE INDEX "DailyTask_createdById_idx" ON "DailyTask"("createdById");

-- CreateIndex
CREATE INDEX "DayEntry_partnerId_entryDate_idx" ON "DayEntry"("partnerId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DayEntry_entryDate_partnerId_key" ON "DayEntry"("entryDate", "partnerId");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Invariants (hand-written; BUSINESS_RULES.md §3).
--
-- These are in the database, not only in the services, because they are true
-- of the data regardless of which code path wrote it — a future script, a
-- console fix or a bug in a service must not be able to leave a half-completed
-- task or a rating of 9 behind.
-- ═══════════════════════════════════════════════════════════════════════════

-- R-TASK-10 — completion is two columns that move together. A completedAt
-- without a completedById would make the summaries' split silently wrong.
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_completion_consistent"
  CHECK (("completedAt" IS NULL) = ("completedById" IS NULL));

-- R-TASK-11 — the same for archiving, and R-TASK-05 requires a reason, so an
-- archived row must carry a non-blank one.
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_archive_consistent"
  CHECK (("archivedAt" IS NULL) = ("archivedById" IS NULL));

ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_archive_reason_present"
  CHECK ("archivedAt" IS NULL OR length(btrim("archiveReason")) > 0);

-- R-TASK-12 — a task with a blank title is unreachable in the UI and
-- meaningless on the list.
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_title_length"
  CHECK (length(btrim("title")) BETWEEN 1 AND 200);

ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_note_length"
  CHECK ("note" IS NULL OR length("note") <= 500);

-- R-TASK-13
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_version_positive"
  CHECK ("version" >= 1);

-- R-DAY-11 / R-DAY-12 — the two ratings are a choice of five steps. The scale
-- is the product's only quantitative claim; a value outside it would poison
-- every average in the summaries.
ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_execution_rating_range"
  CHECK ("executionRating" BETWEEN 1 AND 5);

ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_respect_rating_range"
  CHECK ("respectRating" BETWEEN 1 AND 5);

-- R-DAY-13
ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_note_length"
  CHECK ("note" IS NULL OR length("note") <= 1000);
