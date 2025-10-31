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
  profileMedia?: { keyName: string } | null;
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
    photo: user.profileMedia?.keyName || null,
    bio: user.bio || null,
    verified: user.verified,
    isFollowing,
    isFollower,
  };
};

// Get followers list by status (followers or requests)
export const getFollowersList = async (
  userId: string,
  currentUserId: string,
  followStatus: FollowStatus
) => {
  const followers = await prisma.follow.findMany({
    where: { followingId: userId, status: followStatus },
    include: {
      follower: {
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          verified: true,
          profileMedia: { select: { keyName: true } },
        },
      },
    },
  });
  const followerIds = followers.map((f) => f.follower.id);
  const { followedByCurrentUserSet, followingCurrentUserSet } =
    await checkMutualFollowStatus(followerIds, currentUserId);

  const formattedFollowers = followers.map((follow) => {
    const user = follow.follower;
    const isFollowing = followedByCurrentUserSet.has(user.id);
    const isFollower = followingCurrentUserSet.has(user.id);
    return formatUserForResponse(user, isFollowing, isFollower);
  });

  return {
    users: formattedFollowers,
  };
};

// Get list of followings with mutual follow information
export const getFollowingsList = async (
  userId: string,
  currentUserId: string
) => {
  const followings = await prisma.follow.findMany({
    where: { followerId: userId, status: FollowStatus.ACCEPTED },
    include: {
      following: {
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          verified: true,
          profileMedia: { select: { keyName: true } },
        },
      },
    },
  });
  const followingIds = followings.map((f) => f.following.id);
  const { followedByCurrentUserSet, followingCurrentUserSet } =
    await checkMutualFollowStatus(followingIds, currentUserId);

  const formattedFollowings = followings.map((follow) => {
    const user = follow.following;
    const isFollowing = followedByCurrentUserSet.has(user.id);
    const isFollower = followingCurrentUserSet.has(user.id);
    return formatUserForResponse(user, isFollowing, isFollower);
  });

  return {
    users: formattedFollowings,
  };
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
export const getBlockedList = async (blockerId: string) => {
  const blockedUsers = await prisma.block.findMany({
    where: { blockerId },
    include: {
      blocked: {
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          verified: true,
          profileMedia: { select: { keyName: true } },
        },
      },
    },
  });
  const formattedBlockedUsers = blockedUsers.map((block) => {
    const user = block.blocked;
    return formatUserForResponse(user, false, false);
  });
  return {
    users: formattedBlockedUsers,
  };
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
export const getMutedList = async (muterId: string) => {
  const mutedUsers = await prisma.mute.findMany({
    where: { muterId },
    include: {
      muted: {
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          verified: true,
          profileMedia: { select: { keyName: true } },
        },
      },
    },
  });
  const formattedMutedUsers = mutedUsers.map((mute) => {
    const user = mute.muted;
    return formatUserForResponse(user, false, false);
  });
  return {
    users: formattedMutedUsers,
  };
};
