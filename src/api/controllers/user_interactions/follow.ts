import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";
import { NotificationTitle } from "@prisma/client";
import {
  UserInteractionParamsSchema,
  UserInteractionQuerySchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";
import {
  createFollowRelation,
  removeFollowRelation,
  updateFollowStatus,
  isAlreadyFollowing,
  checkBlockStatus,
  getFollowersList,
  getFollowingsList,
} from "@/application/services/userInteractions";
import { addNotification } from "@/application/services/notification";

// Follow a user using their username
export const followUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToFollow = await resolveUsernameToId(username);

    if (userToFollow.id === currentUserId)
      throw new AppError("Cannot follow yourself", 400);
    const isBlocked = await checkBlockStatus(currentUserId, userToFollow.id);
    if (isBlocked)
      throw new AppError(
        "Cannot follow a user you have blocked or who has blocked you",
        403
      );
    const existingFollow = await isAlreadyFollowing(
      currentUserId,
      userToFollow.id
    );
    if (existingFollow)
      throw new AppError("You are already following this user", 400);

    const followStatus = userToFollow.protectedAccount ? "PENDING" : "ACCEPTED";
    const follow = await createFollowRelation(
      currentUserId,
      userToFollow.id,
      followStatus
    );

    try {
      await addNotification(userToFollow.id as any, {
        title:
          followStatus === "PENDING"
            ? NotificationTitle.REQUEST_TO_FOLLOW
            : NotificationTitle.FOLLOW,
        body:
          followStatus === "PENDING"
            ? `${(req as any).user.username} requested to follow you`
            : `${(req as any).user.username} started following you`,
        actorId: currentUserId as any,
        tweetId: undefined,
      });
    } catch (err) {
      console.error("Failed to send follow notification:", err);
    }

    const statusCode = userToFollow.protectedAccount ? 202 : 201;
    const message = userToFollow.protectedAccount
      ? "Follow request sent"
      : "Successfully followed user";
    return res.status(statusCode).json({ message });
  } catch (error) {
    next(error);
  }
};

// Unfollow a user using their username
export const unfollowUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToUnfollow = await resolveUsernameToId(username);

    const existingFollow = await isAlreadyFollowing(
      currentUserId,
      userToUnfollow.id
    );
    if (!existingFollow)
      throw new AppError("You are not following this user", 400);

    await removeFollowRelation(currentUserId, userToUnfollow.id);
    const statusCode = existingFollow.status === "PENDING" ? 202 : 200;
    const message =
      existingFollow.status === "PENDING"
        ? "Follow request cancelled"
        : "Successfully unfollowed user";
    return res.status(statusCode).json({ message });
  } catch (error) {
    next(error);
  }
};

// Accept a follow request
export const acceptFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const follower = await resolveUsernameToId(username);

    const existingFollow = await isAlreadyFollowing(follower.id, currentUserId);
    if (!existingFollow) throw new AppError("No follow request found", 404);
    if (existingFollow.status === "ACCEPTED")
      throw new AppError("Follow request already accepted", 409);

    await updateFollowStatus(follower.id, currentUserId);

    try {
      await addNotification(follower.id as any, {
        title: NotificationTitle.ACCEPTED_FOLLOW,
        body: `${(req as any).user.username} accepted your follow request`,
        actorId: currentUserId as any,
        tweetId: undefined,
      });
    } catch (err) {
      console.error("Failed to send accepted-follow notification:", err);
    }

    return res.status(200).json({
      message: "Follow request accepted",
    });
  } catch (error) {
    next(error);
  }
};

// Decline a follow request
export const declineFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;

    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const follower = await resolveUsernameToId(username);

    const existingFollow = await isAlreadyFollowing(follower.id, currentUserId);
    if (!existingFollow) throw new AppError("No follow request found", 404);

    await removeFollowRelation(follower.id, currentUserId);
    const statusCode = existingFollow.status === "PENDING" ? 202 : 200;
    const message =
      existingFollow.status === "PENDING"
        ? "Follow request declined"
        : "Follower removed";
    return res.status(statusCode).json({
      message,
    });
  } catch (error) {
    next(error);
  }
};

// Get a list of followers for a user by their username
export const getFollowers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const user = await resolveUsernameToId(username);

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      throw new AppError(
        "Cannot view followers of blocked users or who have blocked you",
        403
      );

    const queryResult = UserInteractionQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    let cursorId: string | undefined;
    if (cursor) {
      const decodedUsername = Buffer.from(cursor, "base64").toString("utf8");
      const resolved = await resolveUsernameToId(decodedUsername);
      cursorId = resolved.id;
    }

    const followersData = await getFollowersList(
      user.id,
      currentUserId,
      cursorId,
      limit
    );
    return res.status(200).json(followersData);
  } catch (error) {
    next(error);
  }
};

// Get a list of followings for a user by their username
export const getFollowings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const user = await resolveUsernameToId(username);

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      throw new AppError(
        "Cannot view followings of blocked users or who have blocked you",
        403
      );

    const queryResult = UserInteractionQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    let cursorId: string | undefined;
    if (cursor) {
      const decodedUsername = Buffer.from(cursor, "base64").toString("utf8");
      const resolved = await resolveUsernameToId(decodedUsername);
      cursorId = resolved.id;
    }

    const followingsData = await getFollowingsList(
      user.id,
      currentUserId,
      cursorId,
      limit
    );

    return res.status(200).json(followingsData);
  } catch (error) {
    next(error);
  }
};
