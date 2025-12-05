import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import * as responseUtils from "@/application/utils/response.utils";
import {
  checkBlockStatus,
  getBlockedList,
  createBlockRelation,
  removeBlockRelation,
} from "@/application/services/userInteractions";
import {
  parseUsernameParam,
  getUserListHandler as getListHandler,
} from "./helpers";

// Block a user using their username
export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const username = parseUsernameParam(req);
    const currentUserId = (req as any).user.id;
    const userToBlock = await resolveUsernameToId(username);

    if (userToBlock.id === currentUserId)
      responseUtils.throwError("CANNOT_BLOCK_SELF");
    const isBlocked = await checkBlockStatus(currentUserId, userToBlock.id);
    if (isBlocked) responseUtils.throwError("ALREADY_BLOCKING");

    await createBlockRelation(currentUserId, userToBlock.id);
    return responseUtils.sendResponse(res, "USER_BLOCKED");
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
    const username = parseUsernameParam(req);
    const currentUserId = (req as any).user.id;
    const userToUnBlock = await resolveUsernameToId(username);

    const isBlocked = await checkBlockStatus(currentUserId, userToUnBlock.id);
    if (!isBlocked) responseUtils.throwError("NOT_BLOCKED");

    await removeBlockRelation(currentUserId, userToUnBlock.id);
    return responseUtils.sendResponse(res, "USER_UNBLOCKED");
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
  return getListHandler(req, res, next, getBlockedList);
};
