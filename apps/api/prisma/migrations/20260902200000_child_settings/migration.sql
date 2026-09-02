-- CreateTable
CREATE TABLE "child_settings" (
    "childId" TEXT NOT NULL,
    "dailyLimitMinutes" INTEGER,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_settings_pkey" PRIMARY KEY ("childId")
);

-- AddForeignKey
ALTER TABLE "child_settings" ADD CONSTRAINT "child_settings_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

