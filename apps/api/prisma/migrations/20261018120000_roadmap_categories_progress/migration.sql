-- DropForeignKey
ALTER TABLE "child_roadmap_progress" DROP CONSTRAINT "child_roadmap_progress_roadmapId_fkey";

-- AlterTable
ALTER TABLE "child_roadmap_progress" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "exercise_attempts" ADD COLUMN     "roadmapId" TEXT;

-- AlterTable
ALTER TABLE "roadmaps" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "coverAssetId" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "roadmap_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverAssetId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_attempts_childId_roadmapId_idx" ON "exercise_attempts"("childId", "roadmapId");

-- CreateIndex
CREATE INDEX "roadmaps_categoryId_idx" ON "roadmaps"("categoryId");

-- AddForeignKey
ALTER TABLE "roadmap_categories" ADD CONSTRAINT "roadmap_categories_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "roadmap_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_roadmap_progress" ADD CONSTRAINT "child_roadmap_progress_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: attribute pre-existing attempts to the oldest roadmap whose
-- stages contain their exercise. Before multi-roadmap play, every attempt
-- came from that original roadmap. Attempts on exercises outside any
-- roadmap stay NULL (they still count for skills and rewards).
UPDATE "exercise_attempts" AS a
SET "roadmapId" = (
  SELECT r."id"
  FROM "roadmaps" r
  JOIN "roadmap_versions" rv ON rv."roadmapId" = r."id"
  JOIN "roadmap_stages" rs ON rs."roadmapVersionId" = rv."id"
  JOIN "stage_items" si ON si."roadmapStageId" = rs."id"
  JOIN "exercise_versions" ev ON ev."exerciseId" = si."exerciseId"
  WHERE ev."id" = a."exerciseVersionId"
  ORDER BY r."createdAt" ASC, r."id" ASC
  LIMIT 1
)
WHERE a."roadmapId" IS NULL;
