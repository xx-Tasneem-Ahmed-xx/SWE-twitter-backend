import { prisma, FollowStatus } from "@/prisma/client";
import * as responseUtils from "@/application/utils/response.utils";
import { addNotification } from "./notification";
import { NotificationTitle } from "@prisma/client";

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
      responseUtils.throwError("ALREADY_FOLLOWING");
    }
    throw error;
  }
};

// Create follow relation then trigger notification (service-level helper)
export const createFollowRelationAndNotify = async (
  followerId: string,
  followingId: string,
  followStatus: string,
  actorUsername?: string
) => {
  const follow = await createFollowRelation(
    followerId,
    followingId,
    followStatus
  );

  // fire notification, but don't let it break the main flow
  try {
    const title =
      followStatus === "PENDING"
        ? NotificationTitle.REQUEST_TO_FOLLOW
        : NotificationTitle.FOLLOW;
    const body =
      followStatus === "PENDING"
        ? `requested to follow you`
        : `started following you`;

    // fire notification (async) - errors handled by try/catch
    await addNotification(followingId as any, {
      title,
      body,
      actorId: followerId,
      tweetId: undefined,
    });
  } catch (err) {
    console.error("Failed to send follow notification:", err);
  }

  return follow;
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

// Update follow status (from PENDING to ACCEPTED) and notify the follower
export const updateFollowStatusAndNotify = async (
  followerId: string,
  followingId: string,
  actorUsername?: string
) => {
  const updated = await updateFollowStatus(followerId, followingId);

  try {
    const body = `accepted your follow request`;
    await addNotification(followerId as any, {
      title: NotificationTitle.ACCEPTED_FOLLOW,
      body,
      actorId: followingId,
      tweetId: undefined,
    });
  } catch (err) {
    console.error("Failed to send accepted-follow notification:", err);
  }

  return updated;
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

// Batch-check follow relations for a set of target users
export const isAlreadyFollowingBatch = async (
  followerId: string,
  followingIds: string[],
  status?: FollowStatus
) => {
  if (!followingIds || followingIds.length === 0) return new Set<string>();
  const where: any = { followerId, followingId: { in: followingIds } };
  if (status) where.status = status;
  const rows = await prisma.follow.findMany({
    where,
    select: { followingId: true },
  });
  return new Set(rows.map((r) => r.followingId));
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

// Standard user selection fields for list queries
const USER_SELECT_FIELDS = {
  id: true,
  username: true,
  name: true,
  bio: true,
  verified: true,
  profileMediaId: true,
} as const;

// Helper function to check follow relationships between users and current user
const checkMutualFollowStatus = async (
  userIds: string[],
  currentUserId: string
) => {
  // Batch-check who currentUser is following (accepted)
  const followedByCurrentUserSet = await isAlreadyFollowingBatch(
    currentUserId,
    userIds,
    FollowStatus.ACCEPTED
  );

  // Batch-check who is following currentUser (accepted)
  const followingCurrentUserRows = await prisma.follow.findMany({
    where: {
      followerId: { in: userIds },
      followingId: currentUserId,
      status: FollowStatus.ACCEPTED,
    },
    select: { followerId: true },
  });

  const followingCurrentUserSetFinal = new Set(
    followingCurrentUserRows.map((f) => f.followerId)
  );

  return {
    followedByCurrentUserSet,
    followingCurrentUserSet: followingCurrentUserSetFinal,
  };
};

// Helper function to format user data for response
type FormatUserOptions = {
  isFollowing?: boolean;
  isFollower?: boolean;
  youRequested?: boolean;
  followStatus?: FollowStatus | "NONE";
};

const formatUserForResponse = (
  user: UserData,
  options: FormatUserOptions = {}
) => {
  const {
    isFollowing = false,
    isFollower = false,
    youRequested = false,
    followStatus = "NONE",
  } = options;

  return {
    username: user.username,
    name: user.name,
    photo: user.profileMediaId,
    bio: user.bio || null,
    verified: user.verified,
    isFollowing,
    isFollower,
    youRequested,
    followStatus,
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

// Helper to compute relationToTarget followStatus for a page of users
const getRelationToTargetStatuses = async (
  userIds: string[],
  targetId: string,
  direction: "EtoT" | "TtoE"
) => {
  if (!userIds || userIds.length === 0) return new Map<string, FollowStatus>();

  if (direction === "EtoT") {
    // returned user (E) -> target (T)
    const rows = await prisma.follow.findMany({
      where: {
        followerId: { in: userIds },
        followingId: targetId,
        status: { in: [FollowStatus.ACCEPTED, FollowStatus.PENDING] },
      },
      select: { followerId: true, status: true },
    });
    const m = new Map<string, FollowStatus>();
    rows.forEach((r) => m.set(r.followerId, r.status as FollowStatus));
    return m;
  }

  // direction T -> E (target follows returned user)
  const rows = await prisma.follow.findMany({
    where: {
      followerId: targetId,
      followingId: { in: userIds },
      status: { in: [FollowStatus.ACCEPTED, FollowStatus.PENDING] },
    },
    select: { followingId: true, status: true },
  });
  const m = new Map<string, FollowStatus>();
  rows.forEach((r) => m.set(r.followingId, r.status as FollowStatus));
  return m;
};

// Generic helper to fetch paginated user lists with relationship data
type UserListOptions = {
  where: any;
  currentUserId: string;
  targetUserId: string;
  relationDirection?: "EtoT" | "TtoE";
  includeRelationships?: boolean;
  cursorId?: string;
  limit?: number;
};

const fetchPaginatedUserList = async ({
  where,
  currentUserId,
  targetUserId,
  relationDirection = "EtoT",
  includeRelationships = true,
  cursorId,
  limit = 30,
}: UserListOptions) => {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);
  const take = effectiveLimit + 1; // fetch one extra to detect hasMore

  const q: any = {
    where,
    select: USER_SELECT_FIELDS,
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

  let users;
  if (includeRelationships) {
    const userIds = page.map((u: any) => u.id);
    const { followedByCurrentUserSet, followingCurrentUserSet } =
      await checkMutualFollowStatus(userIds, currentUserId);

    const pendingRequestsSentByCurrentUserSet = await isAlreadyFollowingBatch(
      currentUserId,
      userIds,
      FollowStatus.PENDING
    );

    const relationMap = await getRelationToTargetStatuses(
      userIds,
      targetUserId,
      relationDirection
    );

    users = page.map((user: any) => {
      const isFollowing = followedByCurrentUserSet.has(user.id);
      const isFollower = followingCurrentUserSet.has(user.id);
      const youRequested = pendingRequestsSentByCurrentUserSet.has(user.id);
      const followStatus = (relationMap.get(user.id) as FollowStatus) ?? "NONE";
      return formatUserForResponse(user, {
        isFollowing,
        isFollower,
        youRequested,
        followStatus,
      });
    });
  } else {
    users = page.map((user: any) => formatUserForResponse(user));
  }

  const nextCursor = await computeNextCursor(page, hasMore);
  return { users, nextCursor, hasMore };
};

// Get followers list by status (followers or requests)
export const getFollowersList = async (
  userId: string,
  currentUserId: string,
  cursorId?: string,
  limit: number = 30
) => {
  return fetchPaginatedUserList({
    where: {
      followings: { some: { followingId: userId } },
    },
    currentUserId,
    targetUserId: userId,
    relationDirection: "EtoT",
    includeRelationships: true,
    cursorId,
    limit,
  });
};

// Get list of followings with mutual follow information
export const getFollowingsList = async (
  userId: string,
  currentUserId: string,
  cursorId?: string,
  limit: number = 30
) => {
  return fetchPaginatedUserList({
    where: {
      followers: {
        some: { followerId: userId },
      },
    },
    currentUserId,
    targetUserId: userId,
    relationDirection: "TtoE",
    includeRelationships: true,
    cursorId,
    limit,
  });
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
    responseUtils.throwError("FAILED_TO_CREATE_BLOCK");
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
    responseUtils.throwError("FAILED_TO_REMOVE_BLOCK");
  }
};

// Get list of users blocked
export const getBlockedList = async (
  blockerId: string,
  cursorId?: string,
  limit: number = 30
) => {
  return fetchPaginatedUserList({
    where: { blocked: { some: { blockerId } } },
    currentUserId: blockerId,
    targetUserId: blockerId,
    includeRelationships: false,
    cursorId,
    limit,
  });
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
    responseUtils.throwError("FAILED_TO_CREATE_MUTE");
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
    responseUtils.throwError("FAILED_TO_REMOVE_MUTE");
  }
};

// Get list of users muted
export const getMutedList = async (
  muterId: string,
  cursorId?: string,
  limit: number = 30
) => {
  return fetchPaginatedUserList({
    where: { muted: { some: { muterId } } },
    currentUserId: muterId,
    targetUserId: muterId,
    relationDirection: "TtoE",
    includeRelationships: true,
    cursorId,
    limit,
  });
};

// Fetch who to follow - top users by followers count
export const fetchWhoToFollow = async (userId: string, limit: number = 30) => {
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      followers: {
        none: {
          followerId: userId,
          status: { in: [FollowStatus.ACCEPTED, FollowStatus.PENDING] },
        },
      },
      muted: {
        none: {
          muterId: userId,
        },
      },
      blocked: {
        none: {
          blockerId: userId,
        },
      },
      blockers: {
        none: {
          blockedId: userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      profileMedia: { select: { id: true } },
      protectedAccount: true,
      verified: true,
      _count: {
        select: { followers: true },
      },
    },
    orderBy: {
      followers: { _count: "desc" },
    },
    take: limit,
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    profileMedia: user.profileMedia,
    protectedAccount: user.protectedAccount,
    verified: user.verified,
    bio: user.bio,
    followersCount: user._count.followers,

    isFollowed: false,
  }));
};
