-- CreateEnum
CREATE TYPE "public"."ReplyControl" AS ENUM ('EVERYONE', 'FOLLOWINGS', 'VERIFIED', 'MENTIONED');

-- CreateEnum
CREATE TYPE "public"."TweetType" AS ENUM ('TWEET', 'REPLY', 'QUOTE');

-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('PENDING', 'SENT', 'READ');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('LIKE', 'RETWEET', 'REPLY', 'QUOTE', 'FOLLOW', 'RequestToFollow', 'AcceptedFollow', 'MENTION');

-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('IMAGE', 'VIDEO', 'GIF');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "saltPassword" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "otp" INTEGER,
    "otpExpiry" TIMESTAMP(3),
    "bio" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "website" TEXT,
    "protectedAccount" BOOLEAN NOT NULL DEFAULT false,
    "profilePhoto" TEXT,
    "cover" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tweets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "retweetCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "replyControl" "public"."ReplyControl" NOT NULL DEFAULT 'EVERYONE',
    "parentId" TEXT,
    "tweetType" "public"."TweetType" NOT NULL,

    CONSTRAINT "tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hashes" (
    "id" TEXT NOT NULL,
    "tag_text" TEXT NOT NULL,

    CONSTRAINT "hashes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tweetHashes" (
    "tweetId" TEXT NOT NULL,
    "hashId" TEXT NOT NULL,

    CONSTRAINT "tweetHashes_pkey" PRIMARY KEY ("tweetId","hashId")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chats" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "DMChat" BOOLEAN NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chatGroups" (
    "name" TEXT,
    "description" TEXT,
    "photo" TEXT,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "chatGroups_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tweetId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medias" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "public"."MediaType" NOT NULL,
    "size" INTEGER,

    CONSTRAINT "medias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TweetMedia" (
    "tweetId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "TweetMedia_pkey" PRIMARY KEY ("tweetId","mediaId")
);

-- CreateTable
CREATE TABLE "public"."MessageMedia" (
    "messageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "MessageMedia_pkey" PRIMARY KEY ("messageId","mediaId")
);

-- CreateTable
CREATE TABLE "public"."TweetSummary" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "TweetSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "public"."Mute" (
    "mutedId" TEXT NOT NULL,
    "muterId" TEXT NOT NULL,

    CONSTRAINT "Mute_pkey" PRIMARY KEY ("muterId","mutedId")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "blockedId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "public"."Mention" (
    "tweetId" TEXT NOT NULL,
    "mentionerId" TEXT NOT NULL,
    "mentionedId" TEXT NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("tweetId","mentionerId","mentionedId")
);

-- CreateTable
CREATE TABLE "public"."Retweet" (
    "userId" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,

    CONSTRAINT "Retweet_pkey" PRIMARY KEY ("userId","tweetId")
);

-- CreateTable
CREATE TABLE "public"."TweetLike" (
    "tweetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TweetLike_pkey" PRIMARY KEY ("userId","tweetId")
);

-- CreateTable
CREATE TABLE "public"."tweetbookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,

    CONSTRAINT "tweetbookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chatusers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "chatusers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "tweets_userId_createdAt_idx" ON "public"."tweets"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "hashes_tag_text_key" ON "public"."hashes"("tag_text");

-- CreateIndex
CREATE INDEX "messages_chatId_createdAt_idx" ON "public"."messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "public"."notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TweetSummary_tweetId_key" ON "public"."TweetSummary"("tweetId");

-- CreateIndex
CREATE UNIQUE INDEX "chatusers_userId_chatId_key" ON "public"."chatusers"("userId", "chatId");

-- AddForeignKey
ALTER TABLE "public"."tweets" ADD CONSTRAINT "tweets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweets" ADD CONSTRAINT "tweets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetHashes" ADD CONSTRAINT "tweetHashes_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetHashes" ADD CONSTRAINT "tweetHashes_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."hashes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatGroups" ADD CONSTRAINT "chatGroups_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetMedia" ADD CONSTRAINT "TweetMedia_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetMedia" ADD CONSTRAINT "TweetMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageMedia" ADD CONSTRAINT "MessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageMedia" ADD CONSTRAINT "MessageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetSummary" ADD CONSTRAINT "TweetSummary_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mute" ADD CONSTRAINT "Mute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mute" ADD CONSTRAINT "Mute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_mentionerId_fkey" FOREIGN KEY ("mentionerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_mentionedId_fkey" FOREIGN KEY ("mentionedId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Retweet" ADD CONSTRAINT "Retweet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Retweet" ADD CONSTRAINT "Retweet_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetLike" ADD CONSTRAINT "TweetLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TweetLike" ADD CONSTRAINT "TweetLike_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetbookmarks" ADD CONSTRAINT "tweetbookmarks_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "public"."tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tweetbookmarks" ADD CONSTRAINT "tweetbookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatusers" ADD CONSTRAINT "chatusers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatusers" ADD CONSTRAINT "chatusers_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
