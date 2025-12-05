/*
  Warnings:

  - A unique constraint covering the columns `[userId,createdAt]` on the table `Retweet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Retweet" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Retweet_userId_createdAt_key" ON "Retweet"("userId", "createdAt");
