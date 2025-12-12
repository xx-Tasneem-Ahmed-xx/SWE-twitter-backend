import "dotenv/config";
import {
  PrismaClient,
  TweetType,
  ReplyControl,
  FollowStatus,
  MediaType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  },
});
export const prisma = new PrismaClient({ adapter });
export { TweetType, ReplyControl, FollowStatus, MediaType };
