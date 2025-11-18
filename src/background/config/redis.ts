import { RedisOptions } from "ioredis";

export const bullRedisConfig: RedisOptions = {
  host: process.env.BULLMQ_REDIS_URL || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};
