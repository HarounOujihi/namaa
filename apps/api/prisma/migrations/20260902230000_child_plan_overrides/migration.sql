-- CreateTable
CREATE TABLE "child_plan_overrides" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" "UserRole" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_plan_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "child_plan_overrides_childId_exerciseId_key" ON "child_plan_overrides"("childId", "exerciseId");

-- AddForeignKey
ALTER TABLE "child_plan_overrides" ADD CONSTRAINT "child_plan_overrides_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_plan_overrides" ADD CONSTRAINT "child_plan_overrides_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

