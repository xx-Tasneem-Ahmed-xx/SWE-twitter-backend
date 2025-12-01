import "dotenv/config";
import {
  PrismaClient,
  TweetType,
  ReplyControl,
  FollowStatus,
  MediaType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
export { TweetType, ReplyControl, FollowStatus, MediaType };
