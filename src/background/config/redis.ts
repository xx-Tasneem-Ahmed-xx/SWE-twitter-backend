import { RedisOptions } from "ioredis";
import { getKey } from "@/application/services/secrets";

let bullRedisConfig: RedisOptions;

export async function initBullRedisConfig(): Promise<void> {
  const host = await getKey("BULLMQ_REDIS_URL");
  const port = await getKey("REDIS_PORT");
  const password = await getKey("REDIS_PASSWORD");

  bullRedisConfig = {
    host,
    port: Number(port),
    password: password || undefined,
    maxRetriesPerRequest: null,
  };
}

export { bullRedisConfig };
