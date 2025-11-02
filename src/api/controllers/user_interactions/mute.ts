import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";
import {
  UserInteractionParamsSchema,
  UserInteractionQuerySchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";
import {
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
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToMute = await resolveUsernameToId(username);

    if (userToMute.id === currentUserId)
      throw new AppError("Cannot mute yourself", 400);
    const isMuted = await checkMuteStatus(currentUserId, userToMute.id);
    if (isMuted) throw new AppError("You are already muting this user", 400);
    const isBlocked = await checkBlockStatus(currentUserId, userToMute.id);
    if (isBlocked)
      throw new AppError(
        "Can't mute blocked users /users who blocked you",
        403
      );
    await createMuteRelation(currentUserId, userToMute.id);
    return res.status(201).json({
      message: "User muted successfully",
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
    if (!paramsResult.success) throw paramsResult.error;
    const { username } = paramsResult.data;
    const currentUserId = (req as any).user.id;
    const userToUnmute = await resolveUsernameToId(username);

    const isMuted = await checkMuteStatus(currentUserId, userToUnmute.id);
    if (!isMuted) throw new AppError("You are not muting this user", 400);

    await removeMuteRelation(currentUserId, userToUnmute.id);
    return res.status(200).json({
      message: "User unmuted successfully",
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
    const queryResult = UserInteractionQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;

    const { cursor, limit } = queryResult.data;
    let cursorId: string | undefined;
    if (cursor) {
      const decodedUsername = Buffer.from(cursor, "base64").toString("utf-8");
      const resolved = await resolveUsernameToId(decodedUsername);
      cursorId = resolved.id;
    }
    const mutedUsersData = await getMutedList(currentUserId, cursorId, limit);

    return res.status(200).json(mutedUsersData);
  } catch (error) {
    next(error);
  }
};
