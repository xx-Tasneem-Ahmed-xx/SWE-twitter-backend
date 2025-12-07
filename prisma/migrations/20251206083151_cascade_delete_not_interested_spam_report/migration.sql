-- DropForeignKey
ALTER TABLE "NotInterested" DROP CONSTRAINT "NotInterested_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "NotInterested" DROP CONSTRAINT "NotInterested_userId_fkey";

-- DropForeignKey
ALTER TABLE "SpamReport" DROP CONSTRAINT "SpamReport_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "SpamReport" DROP CONSTRAINT "SpamReport_tweetId_fkey";

-- AddForeignKey
ALTER TABLE "NotInterested" ADD CONSTRAINT "NotInterested_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotInterested" ADD CONSTRAINT "NotInterested_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpamReport" ADD CONSTRAINT "SpamReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpamReport" ADD CONSTRAINT "SpamReport_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
