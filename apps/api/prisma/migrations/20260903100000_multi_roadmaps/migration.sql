-- AlterTable
ALTER TABLE "roadmaps" DROP COLUMN "isDefault",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

