import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";
import { UserInteractionParamsSchema } from "@/application/dtos/userInteractions/userInteraction.dto.schema";
import {
  createFollowRelationAndNotify,
  removeFollowRelation,
  updateFollowStatusAndNotify,
  isAlreadyFollowing,
  checkBlockStatus,
  getFollowersList,
  getFollowingsList,
} from "@/application/services/userInteractions";
import { getFollowListHandler } from "./helpers";

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
    await createFollowRelationAndNotify(
      currentUserId,
      userToFollow.id,
      followStatus,
      (req as any).user.username
    );

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

    await updateFollowStatusAndNotify(
      follower.id,
      currentUserId,
      (req as any).user.username
    );

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
  return getFollowListHandler(
    req,
    res,
    next,
    "followers",
    getFollowersList,
    getFollowingsList,
    checkBlockStatus
  );
};

// Get a list of followings for a user by their username
export const getFollowings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  return getFollowListHandler(
    req,
    res,
    next,
    "followings",
    getFollowersList,
    getFollowingsList,
    checkBlockStatus
  );
};
