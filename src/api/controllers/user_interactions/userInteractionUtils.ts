import { prisma, FollowStatus } from "@/prisma/client";
import { Response } from "express";

// Check if user is authenticated and return error response if not
// TODO: Again this is to be discussed with auth middleware implementation
export const authenticated = (userId: string, res: Response) => {
  if (!userId) return res.status(400).json({ error: "userId is required" });
  return true;
};

// Check if a user exists by username
export const findUserByUsername = async (username: string) => {
  return prisma.user.findUnique({
    where: { username },
    select: { id: true, protectedAccount: true },
  });
};

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
    if (error.code === "P2002") {
      throw new Error("Already following this user");
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
  profilePhoto: string | null;
  bio: string | null;
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
    photo: user.profilePhoto || null,
    bio: user.bio || null,
    isFollowing,
    isFollower,
  };
};

// Get list of followers with mutual follow information
export const getFollowersList = async (
  userId: string,
  currentUserId: string
) => {
  const userCounts = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: { followers: true, followings: true },
      },
    },
  });
  const followers = await prisma.follow.findMany({
    where: { followingId: userId, status: FollowStatus.ACCEPTED },
    include: {
      follower: {
        select: {
          id: true,
          username: true,
          name: true,
          profilePhoto: true,
          bio: true,
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
    followersCount: userCounts?._count.followers || 0,
    followingsCount: userCounts?._count.followings || 0,
  };
};

// Get list of followings with mutual follow information
export const getFollowingsList = async (
  userId: string,
  currentUserId: string
) => {
  const userCounts = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: { followers: true, followings: true },
      },
    },
  });
  const followings = await prisma.follow.findMany({
    where: { followerId: userId, status: FollowStatus.ACCEPTED },
    include: {
      following: {
        select: {
          id: true,
          username: true,
          name: true,
          profilePhoto: true,
          bio: true,
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
    followersCount: userCounts?._count.followers || 0,
    followingsCount: userCounts?._count.followings || 0,
  };
};
