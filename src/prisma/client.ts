import { PrismaClient, TweetType } from "@/generated/prisma";
export const prisma = new PrismaClient();
export { TweetType };
