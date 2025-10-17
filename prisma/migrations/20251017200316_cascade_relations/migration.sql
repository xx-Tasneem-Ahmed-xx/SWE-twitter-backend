-- DropForeignKey
ALTER TABLE "public"."Block" DROP CONSTRAINT "Block_blockedId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Block" DROP CONSTRAINT "Block_blockerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Follow" DROP CONSTRAINT "Follow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mention" DROP CONSTRAINT "Mention_mentionedId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mention" DROP CONSTRAINT "Mention_mentionerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mention" DROP CONSTRAINT "Mention_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageMedia" DROP CONSTRAINT "MessageMedia_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageMedia" DROP CONSTRAINT "MessageMedia_messageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mute" DROP CONSTRAINT "Mute_mutedId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mute" DROP CONSTRAINT "Mute_muterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Retweet" DROP CONSTRAINT "Retweet_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Retweet" DROP CONSTRAINT "Retweet_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TweetLike" DROP CONSTRAINT "TweetLike_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TweetLike" DROP CONSTRAINT "TweetLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TweetMedia" DROP CONSTRAINT "TweetMedia_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TweetMedia" DROP CONSTRAINT "TweetMedia_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TweetSummary" DROP CONSTRAINT "TweetSummary_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."chatGroups" DROP CONSTRAINT "chatGroups_chatId_fkey";

-- DropForeignKey
ALTER TABLE "public"."chatusers" DROP CONSTRAINT "chatusers_chatId_fkey";

-- DropForeignKey
ALTER TABLE "public"."chatusers" DROP CONSTRAINT "chatusers_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_chatId_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_actorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweetHashes" DROP CONSTRAINT "tweetHashes_hashId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweetHashes" DROP CONSTRAINT "tweetHashes_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweetbookmarks" DROP CONSTRAINT "tweetbookmarks_tweetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweetbookmarks" DROP CONSTRAINT "tweetbookmarks_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweets" DROP CONSTRAINT "tweets_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tweets" DROP CONSTRAINT "tweets_userId_fkey";

-- AddForeignKey
ALTER TABLE "public"."tweets" ADD CONSTRAINT "tweets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweets" ADD CONSTRAINT "tweets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetHashes" ADD CONSTRAINT "tweetHashes_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetHashes" ADD CONSTRAINT "tweetHashes_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."hashes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatGroups" ADD CONSTRAINT "chatGroups_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetMedia" ADD CONSTRAINT "TweetMedia_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetMedia" ADD CONSTRAINT "TweetMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageMedia" ADD CONSTRAINT "MessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageMedia" ADD CONSTRAINT "MessageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetSummary" ADD CONSTRAINT "TweetSummary_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mute" ADD CONSTRAINT "Mute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mute" ADD CONSTRAINT "Mute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_mentionerId_fkey" FOREIGN KEY ("mentionerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_mentionedId_fkey" FOREIGN KEY ("mentionedId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Retweet" ADD CONSTRAINT "Retweet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Retweet" ADD CONSTRAINT "Retweet_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetLike" ADD CONSTRAINT "TweetLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetLike" ADD CONSTRAINT "TweetLike_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetbookmarks" ADD CONSTRAINT "tweetbookmarks_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetbookmarks" ADD CONSTRAINT "tweetbookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatusers" ADD CONSTRAINT "chatusers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatusers" ADD CONSTRAINT "chatusers_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
