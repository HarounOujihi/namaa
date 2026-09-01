-- CreateTable
CREATE TABLE "app_sounds" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assetId" TEXT,
    "textFallback" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_sounds_key_key" ON "app_sounds"("key");

-- AddForeignKey
ALTER TABLE "app_sounds" ADD CONSTRAINT "app_sounds_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
