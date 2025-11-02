import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";
import {
  UserInteractionParamsSchema,
  UserInteractionQuerySchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";
import {
  checkBlockStatus,
  getBlockedList,
  createBlockRelation,
  removeBlockRelation,
} from "../../../application/services/userInteractions";

// Block a user using their username
export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToBlock = await resolveUsernameToId(username);

    if (userToBlock.id === currentUserId)
      throw new AppError("Cannot block yourself", 400);
    const isBlocked = await checkBlockStatus(currentUserId, userToBlock.id);
    if (isBlocked)
      throw new AppError("You are already blocking this user", 400);

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
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToUnBlock = await resolveUsernameToId(username);

    const isBlocked = await checkBlockStatus(currentUserId, userToUnBlock.id);
    if (!isBlocked) throw new AppError("You have not blocked this user", 400);

    await removeBlockRelation(currentUserId, userToUnBlock.id);
    return res.status(200).json({
      message: "User unblocked successfully",
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

    const queryResult = UserInteractionQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    let cursorId: string | undefined;
    if (cursor) {
      const decodedUsername = Buffer.from(cursor, "base64").toString("utf8");
      const resolved = await resolveUsernameToId(decodedUsername);
      cursorId = resolved.id;
    }

    const blockedUsersData = await getBlockedList(
      currentUserId,
      cursorId,
      limit
    );

    return res.status(200).json(blockedUsersData);
  } catch (error) {
    next(error);
  }
};
