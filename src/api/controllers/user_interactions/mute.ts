import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";
import {
  checkBlockStatus,
  checkMuteStatus,
  createMuteRelation,
  removeMuteRelation,
  getMutedList,
} from "@/application/services/userInteractions";
import {
  parseUsernameParam,
  getUserListHandler as getListHandler,
} from "./helpers";

// mute a user using their username
export const muteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const username = parseUsernameParam(req);
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
    const username = parseUsernameParam(req);
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
  return getListHandler(req, res, next, getMutedList);
};
