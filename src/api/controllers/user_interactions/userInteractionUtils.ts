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
  return prisma.follow.create({
    data: {
      followerId,
      followingId,
      status:
        followStatus == "PENDING"
          ? FollowStatus.PENDING
          : FollowStatus.ACCEPTED,
    },
  });
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

// Check if user is already following another user
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
  });
};

// Check if two users have blocked each other
export const checkBlockStatus = async (userId1: string, userId2: string) => {
  return prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });
};
