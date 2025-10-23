import { Request, Response, NextFunction } from "express";
import {
  findUserByUsername,
  createFollowRelation,
  removeFollowRelation,
  updateFollowStatus,
  isAlreadyFollowing,
  checkBlockStatus,
  getFollowersList,
  getFollowingsList,
} from "@/application/services/userInteractions";
import { UserInteractionParamsSchema } from "@/application/dtos/userInteractions/userInteraction.dto.schema";

// Follow a user using their username
export const followUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;

    const userToFollow = await findUserByUsername(username);
    if (!userToFollow) return res.status(404).json({ error: "User not found" });

    if (userToFollow.id === currentUserId)
      return res.status(400).json({ error: "Cannot follow yourself" });
    const isBlocked = await checkBlockStatus(currentUserId, userToFollow.id);
    if (isBlocked)
      return res.status(403).json({
        error: "Cannot follow a user you have blocked or who has blocked you",
      });
    const existingFollow = await isAlreadyFollowing(
      currentUserId,
      userToFollow.id
    );
    if (existingFollow)
      return res
        .status(400)
        .json({ error: "You are already following this user" });

    const followStatus = userToFollow.protectedAccount ? "PENDING" : "ACCEPTED";
    const follow = await createFollowRelation(
      currentUserId,
      userToFollow.id,
      followStatus
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
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToUnfollow = await findUserByUsername(username);
    if (!userToUnfollow)
      return res.status(404).json({ error: "User not found" });

    const existingFollow = await isAlreadyFollowing(
      currentUserId,
      userToUnfollow.id
    );
    if (!existingFollow)
      return res.status(400).json({ error: "You are not following this user" });

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
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;

    const follower = await findUserByUsername(username);
    if (!follower) return res.status(404).json({ error: "User not found" });

    const existingFollow = await isAlreadyFollowing(follower.id, currentUserId);
    if (!existingFollow)
      return res.status(404).json({ error: "No follow request found" });
    if (existingFollow.status === "ACCEPTED")
      return res.status(409).json({ error: "Follow request already accepted" });

    await updateFollowStatus(follower.id, currentUserId);

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
    // Validate request parameters
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }

    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;

    const follower = await findUserByUsername(username);
    if (!follower) return res.status(404).json({ error: "User not found" });

    const existingFollow = await isAlreadyFollowing(follower.id, currentUserId);
    if (!existingFollow)
      return res.status(404).json({ error: "No follow request found" });

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
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;

    const user = await findUserByUsername(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      return res.status(403).json({
        error: "Cannot view followers of blocked users or who have blocked you",
      });

    const followersData = await getFollowersList(user.id, currentUserId);
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
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;

    const user = await findUserByUsername(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      return res.status(403).json({
        error:
          "Cannot view followings of blocked users or who have blocked you",
      });

    const followingsData = await getFollowingsList(user.id, currentUserId);
    return res.status(200).json(followingsData);
  } catch (error) {
    next(error);
  }
};
