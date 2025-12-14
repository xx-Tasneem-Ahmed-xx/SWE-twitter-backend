-- DropForeignKey
ALTER TABLE "tweetCategories" DROP CONSTRAINT "tweetCategories_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "tweetCategories" DROP CONSTRAINT "tweetCategories_tweetId_fkey";

-- AddForeignKey
ALTER TABLE "tweetCategories" ADD CONSTRAINT "tweetCategories_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweetCategories" ADD CONSTRAINT "tweetCategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
