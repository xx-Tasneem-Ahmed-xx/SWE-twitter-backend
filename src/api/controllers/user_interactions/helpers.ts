import { Request, Response, NextFunction } from "express";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import * as responseUtils from "@/application/utils/response.utils";
import {
  UserInteractionParamsSchema,
  UserInteractionQuerySchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";

// Helper to parse and validate username from request params
export const parseUsernameParam = (req: Request) => {
  const paramsResult = UserInteractionParamsSchema.safeParse(req.params);
  if (!paramsResult.success) throw paramsResult.error;
  return paramsResult.data.username;
};

// Helper to parse and validate cursor/limit from request query

export const parseCursorQuery = (req: Request) => {
  const queryResult = UserInteractionQuerySchema.safeParse(req.query);
  if (!queryResult.success) throw queryResult.error;
  return queryResult.data;
};

// Helper to decode cursor (base64 username) to user ID

export const decodeCursorToUserId = async (
  cursor?: string
): Promise<string | undefined> => {
  if (!cursor) return undefined;
  const decodedUsername = Buffer.from(cursor, "base64").toString("utf8");
  const resolved = await resolveUsernameToId(decodedUsername);
  return resolved.id;
};

// Generic handler for getting user lists (blocked/muted users)
export const getUserListHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
  getListFn: (userId: string, cursorId?: string, limit?: number) => Promise<any>
) => {
  try {
    const currentUserId = (req as any).user.id;
    const { cursor, limit } = parseCursorQuery(req);
    const cursorId = await decodeCursorToUserId(cursor ?? undefined);
    const data = await getListFn(currentUserId, cursorId, limit);
    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// Handler for getting followers/followings lists with username resolution and block checking
export const getFollowListHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
  listType: "followers" | "followings",
  getFollowersFn: (
    userId: string,
    currentUserId: string,
    cursorId?: string,
    limit?: number
  ) => Promise<any>,
  getFollowingsFn: (
    userId: string,
    currentUserId: string,
    cursorId?: string,
    limit?: number
  ) => Promise<any>,
  checkBlockFn: (userId1: string, userId2: string) => Promise<boolean>
) => {
  try {
    const username = parseUsernameParam(req);
    const currentUserId = (req as any).user.id;
    const user = await resolveUsernameToId(username);

    const isBlocked = await checkBlockFn(user.id, currentUserId);
    if (isBlocked) {
      const errorKey =
        listType === "followers" ? "BLOCKED_FOLLOWERS" : "BLOCKED_FOLLOWINGS";
      responseUtils.throwError(errorKey);
    }

    const { cursor, limit } = parseCursorQuery(req);
    const cursorId = await decodeCursorToUserId(cursor ?? undefined);

    const data =
      listType === "followers"
        ? await getFollowersFn(user.id, currentUserId, cursorId, limit)
        : await getFollowingsFn(user.id, currentUserId, cursorId, limit);

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
