import { PrismaClient, TweetType, ReplyControl } from "@prisma/client";
export const prisma = new PrismaClient();
export { TweetType, ReplyControl };
