import {
  PrismaClient,
  TweetType,
  ReplyControl,
  FollowStatus,
} from "@prisma/client";
export const prisma = new PrismaClient();
export { TweetType, ReplyControl, FollowStatus };
