import { Request, Response } from "express";
import {
  authenticated,
  findUserByUsername,
  createFollowRelation,
  removeFollowRelation,
  updateFollowStatus,
  isAlreadyFollowing,
  checkBlockStatus,
} from "@/api/controllers/user_interactions/userInteractionUtils";

// Follow a user using their username
export const followUser = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    const userToFollow = await findUserByUsername(username);
    if (!userToFollow) return res.status(404).json({ error: "User not found" });

    if (userToFollow.id === currentUserId)
      return res.status(400).json({ error: "Cannot follow yourself" });
    const blockStatus = await checkBlockStatus(currentUserId, userToFollow.id);
    if (blockStatus)
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
    const { username } = req.params;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;
    const userToUnfollow = await findUserByUsername(username);
    if (!userToUnfollow)
      return res.status(404).json({ error: "User not found" });

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
    const { followerId } = req.params;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    await updateFollowStatus(followerId, currentUserId);

    return res.status(201).json({
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
    const { followerId } = req.params;
    //TODO: get currentUserId from auth middleware ( currentUserId from req body just for now)
    const currentUserId = req.body.id;
    if (!authenticated(currentUserId, res)) return;

    await removeFollowRelation(followerId, currentUserId);

    return res.status(201).json({
      message: "Follow request declined",
      currentUserId,
    });
  } catch (error) {
    console.error("Follow Decline error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
