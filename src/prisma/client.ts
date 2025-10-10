import {
  PrismaClient,
  TweetType,
  ReplyControl,
  FollowStatus,
  MediaType,
} from "@prisma/client";
export const prisma = new PrismaClient();
export { TweetType, ReplyControl, FollowStatus, MediaType };
