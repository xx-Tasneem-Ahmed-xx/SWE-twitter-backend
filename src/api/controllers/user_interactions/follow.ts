import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import * as responseUtils from "@/application/utils/response.utils";
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
      responseUtils.throwError("CANNOT_FOLLOW_SELF");
    const isBlocked = await checkBlockStatus(currentUserId, userToFollow.id);
    if (isBlocked) responseUtils.throwError("CANNOT_FOLLOW_BLOCKED_USER");

    const existingFollow = await isAlreadyFollowing(
      currentUserId,
      userToFollow.id
    );
    if (existingFollow) responseUtils.throwError("ALREADY_FOLLOWING");
    const followStatus = userToFollow.protectedAccount ? "PENDING" : "ACCEPTED";
    await createFollowRelationAndNotify(
      currentUserId,
      userToFollow.id,
      followStatus,
      (req as any).user.username
    );

    const key = userToFollow.protectedAccount
      ? "FOLLOW_REQUEST_SENT"
      : "SUCCESSFULLY_FOLLOWED_USER";
    return responseUtils.sendResponse(res, key);
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
    if (!existingFollow) responseUtils.throwError("NOT_FOLLOWING_USER");

    await removeFollowRelation(currentUserId, userToUnfollow.id);
    const key =
      existingFollow?.status === "PENDING"
        ? "FOLLOW_REQUEST_CANCELLED"
        : "UNFOLLOWED_USER";
    return responseUtils.sendResponse(res, key);
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
    if (!existingFollow) responseUtils.throwError("NO_FOLLOW_REQUEST_FOUND");
    if (existingFollow?.status === "ACCEPTED")
      responseUtils.throwError("FOLLOW_ALREADY_ACCEPTED");

    await updateFollowStatusAndNotify(
      follower.id,
      currentUserId,
      (req as any).user.username
    );
    responseUtils.sendResponse(res, "FOLLOW_REQUEST_ACCEPTED");
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
    if (!existingFollow) responseUtils.throwError("NO_FOLLOW_REQUEST_FOUND");

    await removeFollowRelation(follower.id, currentUserId);
    const key =
      existingFollow?.status === "PENDING"
        ? "FOLLOW_REQUEST_DECLINED"
        : "UNFOLLOWED_USER";
    responseUtils.sendResponse(res, key);
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
