/*
  Warnings:

  - A unique constraint covering the columns `[userId,createdAt]` on the table `TweetLike` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,createdAt]` on the table `tweetbookmarks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TweetLike_userId_createdAt_key" ON "TweetLike"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tweetbookmarks_userId_createdAt_key" ON "tweetbookmarks"("userId", "createdAt");
