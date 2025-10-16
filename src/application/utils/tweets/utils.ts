import { prisma, ReplyControl } from "@/prisma/client";

export const validToRetweetOrQuote = async (parentTweetId: string) => {
  const rightToTweet = await prisma.tweet.findUnique({
    where: { id: parentTweetId },
    select: { user: { select: { protectedAccount: true } } },
  });
  return rightToTweet ? !rightToTweet.user.protectedAccount : false;
};

export const isFollower = async (followerId: string, followingId: string) => {
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
  return !!row;
};
export const resolveUsernameToId = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user?.id) throw new Error("User not found");
  return user.id;
};
export const isVerified = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { verified: true },
  });

  return user?.verified ?? false;
};

export const isMentioned = async (
  mentionedId: string,
  mentionerId: string,
  tweetId: string
) => {
  const row = prisma.mention.findUnique({
    where: {
      tweetId_mentionerId_mentionedId: { tweetId, mentionerId, mentionedId },
    },
  });
  return !!row;
};

export const validToReply = async (id: string, userId: string) => {
  if (!id || !userId) return false;

  const tweet = await prisma.tweet.findUnique({
    where: { id },
    select: {
      userId: true,
      user: { select: { protectedAccount: true } },
      replyControl: true,
    },
  });
  if (!tweet) return false;

  const protectedAccount = tweet?.user?.protectedAccount ?? false;
  const replyControl = await evaluateReplyControl(
    id,
    tweet.replyControl,
    tweet.userId,
    userId
  );
  if (protectedAccount) {
    const follows = await isFollower(userId, tweet.userId);
    return follows && replyControl;
  }
  return replyControl;
};

const evaluateReplyControl = async (
  tweetId: string,
  type: ReplyControl,
  replieeId: string,
  replierId: string
) => {
  switch (type) {
    case "EVERYONE":
      return true;

    case "FOLLOWINGS":
      return isFollower(replierId, replieeId);

    case "VERIFIED":
      return isVerified(replierId);

    case "MENTIONED":
      return isMentioned(replierId, replieeId, tweetId);
    default:
      return false;
  }
};
