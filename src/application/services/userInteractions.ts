import { prisma, FollowStatus } from "@/prisma/client";
import { AppError } from "@/errors/AppError";

// Create a follow relationship
export const createFollowRelation = async (
  followerId: string,
  followingId: string,
  followStatus: string
) => {
  try {
    return await prisma.follow.create({
      data: {
        followerId,
        followingId,
        status:
          followStatus == "PENDING"
            ? FollowStatus.PENDING
            : FollowStatus.ACCEPTED,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new AppError("Already following this user", 400);
    }
    throw error;
  }
};

// Remove a follow relationship
export const removeFollowRelation = async (
  followerId: string,
  followingId: string
) => {
  return prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
};

// Update follow status (from PENDING to ACCEPTED)
export const updateFollowStatus = async (
  followerId: string,
  followingId: string
) => {
  return prisma.follow.update({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
    data: {
      status: FollowStatus.ACCEPTED,
    },
  });
};

// Check if user is already following another user and return the relationship with status if found
export const isAlreadyFollowing = async (
  followerId: string,
  followingId: string
) => {
  return prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
    select: {
      followerId: true,
      followingId: true,
      status: true,
    },
  });
};

// Check if two users have blocked each other
export const checkBlockStatus = async (userId1: string, userId2: string) => {
  const blockCount = await prisma.block.count({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });
  return blockCount > 0;
};

// Helper type for user data
type UserData = {
  id: string;
  username: string;
  name: string | null;
  profileMediaId: string | null;
  bio: string | null;
  verified: boolean;
};

// Helper function to check follow relationships between users and current user
const checkMutualFollowStatus = async (
  userIds: string[],
  currentUserId: string
) => {
  const followedByCurrentUser = await prisma.follow.findMany({
    where: {
      followerId: currentUserId,
      followingId: { in: userIds },
      status: FollowStatus.ACCEPTED,
    },
    select: { followingId: true },
  });

  // Check which users are following the current user
  const followingCurrentUser = await prisma.follow.findMany({
    where: {
      followerId: { in: userIds },
      followingId: currentUserId,
      status: FollowStatus.ACCEPTED,
    },
    select: { followerId: true },
  });

  const followedByCurrentUserSet = new Set(
    followedByCurrentUser.map((follow) => follow.followingId)
  );
  const followingCurrentUserSet = new Set(
    followingCurrentUser.map((follow) => follow.followerId)
  );

  return {
    followedByCurrentUserSet,
    followingCurrentUserSet,
  };
};

// Helper function to format user data for response
const formatUserForResponse = (
  user: UserData,
  isFollowing: boolean,
  isFollower: boolean
) => {
  return {
    username: user.username,
    name: user.name,
    photo: user.profileMediaId,
    bio: user.bio || null,
    verified: user.verified,
    isFollowing,
    isFollower,
  };
};

// Helper to compute the nextCursor (username-base64) from the last row of a page
const computeNextCursor = async (page: any[], hasMore: boolean) => {
  if (!hasMore || page.length === 0) return null;
  const lastId = page[page.length - 1].id;
  const nextUser = await prisma.user.findUnique({
    where: { id: lastId },
    select: { username: true },
  });
  return nextUser ? Buffer.from(nextUser.username).toString("base64") : null;
};

// Get followers list by status (followers or requests)
export const getFollowersList = async (
  userId: string,
  currentUserId: string,
  followStatus: FollowStatus,
  cursorId?: string,
  limit: number = 30
) => {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const take = effectiveLimit + 1; // fetch one extra to detect hasMore

  const q: any = {
    where: {
      followings: { some: { followingId: userId, status: followStatus } },
    },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      verified: true,
      profileMediaId: true,
    },
    orderBy: { id: "asc" },
    take,
  };

  if (cursorId) {
    q.cursor = { id: cursorId };
    q.skip = 1;
  }

  const rows = await prisma.user.findMany(q);
  const hasMore = rows.length === take;
  const page = hasMore ? rows.slice(0, -1) : rows;

  const userIds = page.map((u: any) => u.id);
  const { followedByCurrentUserSet, followingCurrentUserSet } =
    await checkMutualFollowStatus(userIds, currentUserId);

  const users = page.map((user: any) => {
    const isFollowing = followedByCurrentUserSet.has(user.id);
    const isFollower = followingCurrentUserSet.has(user.id);
    return formatUserForResponse(user, isFollowing, isFollower);
  });

  const nextCursor = await computeNextCursor(page, hasMore);
  return { users, nextCursor, hasMore };
};

// Get list of followings with mutual follow information
export const getFollowingsList = async (
  userId: string,
  currentUserId: string,
  cursorId?: string,
  limit: number = 30
) => {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const take = effectiveLimit + 1;

  const q: any = {
    where: {
      followers: {
        some: { followerId: userId, status: FollowStatus.ACCEPTED },
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      verified: true,
      profileMediaId: true,
    },
    orderBy: { id: "asc" },
    take,
  };

  if (cursorId) {
    q.cursor = { id: cursorId };
    q.skip = 1;
  }

  const rows = await prisma.user.findMany(q);
  const hasMore = rows.length === take;
  const page = hasMore ? rows.slice(0, -1) : rows;

  const userIds = page.map((u: any) => u.id);
  const { followedByCurrentUserSet, followingCurrentUserSet } =
    await checkMutualFollowStatus(userIds, currentUserId);

  const users = page.map((user: any) => {
    const isFollowing = followedByCurrentUserSet.has(user.id);
    const isFollower = followingCurrentUserSet.has(user.id);
    return formatUserForResponse(user, isFollowing, isFollower);
  });

  const nextCursor = await computeNextCursor(page, hasMore);
  return { users, nextCursor, hasMore };
};

// Block a user
export const createBlockRelation = async (
  blockerId: string,
  blockedId: string
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      });
      await tx.mute.deleteMany({
        where: {
          muterId: blockerId,
          mutedId: blockedId,
        },
      });
      return await tx.block.create({
        data: {
          blockerId,
          blockedId,
        },
      });
    });
  } catch (error) {
    console.error("Create block relation error:", error);
    throw new AppError("Failed to create block relation", 500);
  }
};

// Unblock a user
export const removeBlockRelation = async (
  blockerId: string,
  blockedId: string
) => {
  try {
    await prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
  } catch (error) {
    console.error("Remove block relation error:", error);
    throw new AppError("Failed to remove block relation", 500);
  }
};

// Get list of users blocked
export const getBlockedList = async (
  blockerId: string,
  cursorId?: string,
  limit: number = 30
) => {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const take = effectiveLimit + 1;

  const q: any = {
    where: { blocked: { some: { blockerId } } },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      verified: true,
      profileMediaId: true,
    },
    orderBy: { id: "asc" },
    take,
  };
  if (cursorId) {
    q.cursor = { id: cursorId };
    q.skip = 1;
  }

  const rows = await prisma.user.findMany(q);
  const hasMore = rows.length === take;
  const page = hasMore ? rows.slice(0, -1) : rows;
  const users = page.map((user: any) =>
    formatUserForResponse(user, false, false)
  );
  const nextCursor = await computeNextCursor(page, hasMore);

  return { users, nextCursor, hasMore };
};

// check if user is muted by muterId
export const checkMuteStatus = async (muterId: string, mutedId: string) => {
  const muteCount = await prisma.mute.count({
    where: {
      muterId,
      mutedId,
    },
  });
  return muteCount > 0;
};

// mute a user
export const createMuteRelation = async (muterId: string, mutedId: string) => {
  try {
    return await prisma.mute.create({
      data: {
        muterId,
        mutedId,
      },
    });
  } catch (error) {
    console.error("Mute user error:", error);
    throw new AppError("Failed to create mute relation", 500);
  }
};

// unmute a user
export const removeMuteRelation = async (muterId: string, mutedId: string) => {
  try {
    await prisma.mute.delete({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId,
        },
      },
    });
  } catch (error) {
    console.error("Remove mute relation error:", error);
    throw new AppError("Failed to remove mute relation", 500);
  }
};

// Get list of users muted
export const getMutedList = async (
  muterId: string,
  cursorId?: string,
  limit: number = 30
) => {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const take = effectiveLimit + 1;

  const q: any = {
    where: { muted: { some: { muterId } } },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      verified: true,
      profileMediaId: true,
    },
    orderBy: { id: "asc" },
    take,
  };
  if (cursorId) {
    q.cursor = { id: cursorId };
    q.skip = 1;
  }

  const rows = await prisma.user.findMany(q);
  const hasMore = rows.length === take;
  const page = hasMore ? rows.slice(0, -1) : rows;
  const users = page.map((user: any) =>
    formatUserForResponse(user, false, false)
  );
  const nextCursor = await computeNextCursor(page, hasMore);
  return { users, nextCursor, hasMore };
};
