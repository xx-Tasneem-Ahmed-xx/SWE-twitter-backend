/*
  Warnings:

  - You are about to drop the column `photo` on the `chatGroups` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "chatGroups" DROP COLUMN "photo",
ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "tweets" ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "chatGroups" ADD CONSTRAINT "chatGroups_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "medias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
