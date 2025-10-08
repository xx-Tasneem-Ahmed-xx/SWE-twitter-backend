import { PrismaClient, TweetType, FollowStatus } from "@/generated/prisma";
export const prisma = new PrismaClient();
export { TweetType, FollowStatus };
