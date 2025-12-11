import { prisma, ReplyControl } from "@/prisma/client";
import { encoderService } from "../services/encoder";

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
  const row = await prisma.mention.findUnique({
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

export const updateCursor = <T>(
  records: T[],
  limit: number,
  getCursorFn: (record: T) => Record<string, any>
) => {
  const hasNextPage = records.length > limit;
  const paginatedRecords = hasNextPage ? records.slice(0, -1) : records;

  const lastRecord = paginatedRecords[paginatedRecords.length - 1];
  const cursor = lastRecord ? getCursorFn(lastRecord) : null;

  return {
    paginatedRecords,
    cursor: hasNextPage ? encoderService.encode(cursor) : null,
  };
};

const formatUser = (user: any) => {
  const { _count, ...restUser } = user ?? {};
  return {
    ...restUser,
    isFollowed: (_count?.followers ?? 0) > 0,
  };
};

export const checkUserInteractions = (tweets: any[]) => {
  return tweets.map((t) => {
    const { tweetLikes, retweets, tweetBookmark, user, ...tweet } = t;

    return {
      ...tweet,
      user: formatUser(user),
      isLiked: tweetLikes.length > 0,
      isRetweeted: retweets.length > 0,
      isBookmarked: tweetBookmark.length > 0,
    };
  });
};

export const userSelectFields = (viewerId?: string) => {
  return {
    id: true,
    name: true,
    username: true,
    profileMedia: { select: { id: true } },
    protectedAccount: true,
    verified: true,
    _count: viewerId
      ? {
          select: { followers: { where: { followerId: viewerId } } },
        }
      : undefined,
  };
};
export const mediaSelectFields = () => {
  return {
    id: true,
    type: true,
    name: true,
    size: true,
  };
};

export const tweetSelectFields = (userId?: string) => {
  return {
    id: true,
    content: true,
    createdAt: true,
    likesCount: true,
    repliesCount: true,
    quotesCount: true,
    retweetCount: true,
    replyControl: true,
    tweetType: true,
    parentId: true,
    userId: true,
    user: {
      select: userSelectFields(userId),
    },
    ...(userId
      ? {
          tweetLikes: {
            where: { userId },
            select: { userId: true },
          },
          retweets: {
            where: { userId },
            select: { userId: true },
          },
          tweetBookmark: {
            where: { userId },
            select: { userId: true },
          },
        }
      : {}),
    hashtags: {
      select: { hash: { select: { id: true, tag_text: true } } },
    },
    tweetMedia: {
      select: { media: { select: mediaSelectFields() } },
    },
    tweetCategories: {
      select: { category: { select: { name: true } } },
    },
  };
};
