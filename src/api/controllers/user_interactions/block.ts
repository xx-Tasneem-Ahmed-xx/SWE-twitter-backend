import { Request, Response, NextFunction } from "express";
import {
  findUserByUsername,
  checkBlockStatus,
  getBlockedList,
  createBlockRelation,
  removeBlockRelation,
} from "../../../application/services/userInteractions";
import { UserInteractionParamsSchema } from "@/application/dtos/userInteractions/userInteraction.dto.schema";

// Block a user using their username
export const blockUser = async (
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

    const userToBlock = await findUserByUsername(username);
    if (!userToBlock) return res.status(404).json({ error: "User not found" });

    if (userToBlock.id === currentUserId)
      return res.status(400).json({ error: "Cannot block yourself" });
    const isBlocked = await checkBlockStatus(currentUserId, userToBlock.id);
    if (isBlocked)
      return res.status(400).json({
        error: "You are already blocking this user",
      });

    await createBlockRelation(currentUserId, userToBlock.id);
    return res.status(201).json({
      message: "User blocked successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Unblock a user using their username
export const unblockUser = async (
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

    const userToUnBlock = await findUserByUsername(username);
    if (!userToUnBlock)
      return res.status(404).json({ error: "User not found" });

    if (userToUnBlock.id === currentUserId)
      return res.status(400).json({ error: "Cannot unblock yourself" });
    const isBlocked = await checkBlockStatus(currentUserId, userToUnBlock.id);
    if (!isBlocked)
      return res.status(400).json({
        error: "You are not blocking this user",
      });

    await removeBlockRelation(currentUserId, userToUnBlock.id);
    return res.status(200).json({
      message: "User unblocked successfully",
      currentUserId,
    });
  } catch (error) {
    next(error);
  }
};

// Get a list of accounts blocked by the current user
export const getBlockedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentUserId = (req as any).user.id;

    const blockedUsersData = await getBlockedList(currentUserId);
    return res.status(200).json(blockedUsersData);
  } catch (error) {
    next(error);
  }
};
