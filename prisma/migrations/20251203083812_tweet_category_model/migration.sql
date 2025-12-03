-- CreateTable
CREATE TABLE "tweet_categories" (
    "tweetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "tweet_categories_pkey" PRIMARY KEY ("tweetId","categoryId")
);

-- AddForeignKey
ALTER TABLE "tweet_categories" ADD CONSTRAINT "tweet_categories_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_categories" ADD CONSTRAINT "tweet_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
