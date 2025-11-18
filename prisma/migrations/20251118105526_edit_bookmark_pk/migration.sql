/*
  Warnings:

  - The primary key for the `tweetbookmarks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `tweetbookmarks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tweetbookmarks" DROP CONSTRAINT "tweetbookmarks_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "tweetbookmarks_pkey" PRIMARY KEY ("userId", "tweetId");
