import { RedisOptions } from "ioredis";
//import { getKey } from "@/application/services/secrets";
import dotenv from "dotenv";

dotenv.config();

let bullRedisConfig: RedisOptions;

export async function initBullRedisConfig(): Promise<void> {
  const host = process.env.BULLMQ_REDIS_URL
  const port = process.env.REDIS_PORT;
  const password = process.env.REDIS_PASSWORD;

  bullRedisConfig = {
    host,
    port: Number(port),
    password: password || undefined,
    maxRetriesPerRequest: null,
  };
}

export { bullRedisConfig };
