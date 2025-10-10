import { Request, Response } from "express";
import {
  authenticated,
  findUserByUsername,
  createFollowRelation,
  removeFollowRelation,
  updateFollowStatus,
  isAlreadyFollowing,
  checkBlockStatus,
  getFollowersList,
  getFollowingsList,
} from "@/api/controllers/user_interactions/userInteractionUtils";
import {
  UserInteractionParamsSchema,
  FollowsListResponseSchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";

// Follow a user using their username
export const followUser = async (req: Request, res: Response) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

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
    await createFollowRelation(currentUserId, userToFollow.id, followStatus);

    return res.status(201).json({
      message: userToFollow.protectedAccount
        ? "Follow request sent"
        : "Successfully followed user",
      currentUserId,
    });
  } catch (error) {
    console.error("Follow user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Unfollow a user using their username
export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;
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

    return res.status(200).json({ message: "Successfully unfollowed user" });
  } catch (error) {
    console.error("Unfollow user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Accept a follow request
export const acceptFollow = async (req: Request, res: Response) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

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
      currentUserId,
    });
  } catch (error) {
    console.error("Follow Accept error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Decline a follow request
export const declineFollow = async (req: Request, res: Response) => {
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
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    const follower = await findUserByUsername(username);
    if (!follower) return res.status(404).json({ error: "User not found" });

    const existingFollow = await isAlreadyFollowing(follower.id, currentUserId);
    if (!existingFollow)
      return res.status(404).json({ error: "No follow request found" });

    await removeFollowRelation(follower.id, currentUserId);

    return res.status(200).json({
      message:
        existingFollow.status === "PENDING"
          ? "Follow request declined"
          : "Follower removed",
      currentUserId,
    });
  } catch (error) {
    console.error("Follow Decline error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get a list of followers for a user by their username
export const getFollowers = async (req: Request, res: Response) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    const user = await findUserByUsername(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      return res.status(403).json({
        error: "Cannot view followers of blocked users or who have blocked you",
      });

    // Get the followers list using our optimized utility function
    const followersData = await getFollowersList(user.id, currentUserId);

    // Return the formatted response matching our DTO structure
    return res.status(200).json(followersData);
  } catch (error) {
    console.error("Get Followers error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get a list of followings for a user by their username
export const getFollowings = async (req: Request, res: Response) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: paramsResult.error.format(),
      });
    }
    const { username } = paramsResult.data;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    const user = await findUserByUsername(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isBlocked = await checkBlockStatus(user.id, currentUserId);
    if (isBlocked)
      return res.status(403).json({
        error:
          "Cannot view followings of blocked users or who have blocked you",
      });

    // Get the followings list using our optimized utility function
    const followingsData = await getFollowingsList(user.id, currentUserId);

    // Return the formatted response matching our DTO structure
    return res.status(200).json(followingsData);
  } catch (error) {
    console.error("Get Followings error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
