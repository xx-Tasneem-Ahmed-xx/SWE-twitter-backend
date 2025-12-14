import "dotenv/config";
import {
  PrismaClient,
  TweetType,
  ReplyControl,
  FollowStatus,
  MediaType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

const poolConfig = {
  max: isProduction ? 10 : isDevelopment ? 5 : 2,
  min: isProduction ? 2 : 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  acquireTimeoutMillis: 20000,
  allowExitOnIdle: true,
  statement_timeout: 30000,
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  pool: poolConfig,
});

export const prisma = new PrismaClient({
  adapter,
});

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

export { TweetType, ReplyControl, FollowStatus, MediaType };
