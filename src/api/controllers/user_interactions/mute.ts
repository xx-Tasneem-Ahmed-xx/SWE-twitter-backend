import { Request, Response, NextFunction } from "express";
import { UserInteractionParamsSchema } from "@/application/dtos/userInteractions/userInteraction.dto.schema";
import {
  findUserByUsername,
  checkBlockStatus,
  checkMuteStatus,
  createMuteRelation,
  removeMuteRelation,
  getMutedList,
} from "@/application/services/userInteractions";

// mute a user using their username
export const muteUser = async (
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

    const userToMute = await findUserByUsername(username);
    if (!userToMute) return res.status(404).json({ error: "User not found" });

    if (userToMute.id === currentUserId)
      return res.status(400).json({ error: "Cannot mute yourself" });

    const isMuted = await checkMuteStatus(currentUserId, userToMute.id);
    if (isMuted)
      return res.status(400).json({
        error: "You are already muting this user",
      });

    const isBlocked = await checkBlockStatus(currentUserId, userToMute.id);
    if (isBlocked)
      return res.status(403).json({
        error: "Can't mute blocked users /users who blocked you",
      });

    await createMuteRelation(currentUserId, userToMute.id);
    return res.status(201).json({
      message: "User muted successfully",
      currentUserId,
    });
  } catch (error) {
    next(error);
  }
};

// unmute a user using their username
export const unmuteUser = async (
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

    const userToUnmute = await findUserByUsername(username);
    if (!userToUnmute) return res.status(404).json({ error: "User not found" });

    const isMuted = await checkMuteStatus(currentUserId, userToUnmute.id);
    if (!isMuted)
      return res.status(400).json({
        error: "You are not muting this user",
      });

    await removeMuteRelation(currentUserId, userToUnmute.id);
    return res.status(200).json({
      message: "User unmuted successfully",
      currentUserId,
    });
  } catch (error) {
    next(error);
  }
};

// Get list of users muted by the current user
export const getMutedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentUserId = (req as any).user.id;

    const mutedUsersData = await getMutedList(currentUserId);
    return res.status(200).json(mutedUsersData);
  } catch (error) {
    next(error);
  }
};
