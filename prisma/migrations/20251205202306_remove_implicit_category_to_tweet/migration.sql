/*
  Warnings:

  - You are about to drop the `_CategoryToTweet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tweet_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CategoryToTweet" DROP CONSTRAINT "_CategoryToTweet_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToTweet" DROP CONSTRAINT "_CategoryToTweet_B_fkey";

-- DropForeignKey
ALTER TABLE "tweet_categories" DROP CONSTRAINT "tweet_categories_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "tweet_categories" DROP CONSTRAINT "tweet_categories_tweetId_fkey";

-- DropTable
DROP TABLE "_CategoryToTweet";

-- DropTable
DROP TABLE "tweet_categories";

-- CreateTable
CREATE TABLE "tweetCategories" (
    "tweetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "tweetCategories_pkey" PRIMARY KEY ("tweetId","categoryId")
);

-- AddForeignKey
ALTER TABLE "tweetCategories" ADD CONSTRAINT "tweetCategories_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweetCategories" ADD CONSTRAINT "tweetCategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
