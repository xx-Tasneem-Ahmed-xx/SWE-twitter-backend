import { RedisOptions } from "ioredis";

export const bullRedisConfig: RedisOptions = {
  host: process.env.BULLMQ_REDIS_HOST ,
  port: Number(process.env.BULLMQ_REDIS_PORT),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};