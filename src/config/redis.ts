import { createClient, RedisClientType } from "redis";
import { getKey } from "@/application/services/secrets";

const Ctx: {} = {};

let redisClient: RedisClientType;

export async function initRedisClient(): Promise<void> {
  const redisUrl = await getKey("RED_URL");

  redisClient = createClient({
    url: redisUrl,
    password: "",
    database: 0,
  });

  redisClient.on("error", (err: Error) => {
    console.error("Redis connection error:", err);
    process.exit(1);
  });

  redisClient.on("connect", () => {
    console.log("Connected to Redis successfully");
  });
}

export async function connectRedis(): Promise<void> {
  try {
    if (!redisClient) {
      await initRedisClient();
    }

    await redisClient.connect();
    await redisClient.ping();

    console.log("Redis connected and cache cleared (FlushAll complete)");
  } catch (err) {
    console.error("Something went wrong during Redis connection:", err);
    process.exit(1);
  }
}

export { redisClient, Ctx };
