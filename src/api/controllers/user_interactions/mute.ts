import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import * as responseUtils from "@/application/utils/response.utils";
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
      responseUtils.throwError("CANNOT_MUTE_SELF");

    const isMuted = await checkMuteStatus(currentUserId, userToMute.id);
    if (isMuted) responseUtils.throwError("ALREADY_MUTING");

    const isBlocked = await checkBlockStatus(currentUserId, userToMute.id);
    if (isBlocked) responseUtils.throwError("MUTE_BLOCKED_USER");
    await createMuteRelation(currentUserId, userToMute.id);
    return responseUtils.sendResponse(res, "USER_MUTED");
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
    if (!isMuted) responseUtils.throwError("NOT_MUTING");

    await removeMuteRelation(currentUserId, userToUnmute.id);
    return responseUtils.sendResponse(res, "USER_UNMUTED");
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
