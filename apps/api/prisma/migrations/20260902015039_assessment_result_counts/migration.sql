/*
  Warnings:

  - Added the required column `correctCount` to the `assessment_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCount` to the `assessment_results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "assessment_results" ADD COLUMN     "correctCount" INTEGER NOT NULL,
ADD COLUMN     "totalCount" INTEGER NOT NULL;
