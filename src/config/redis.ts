import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType;

export async function initRedis() {
  redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on("error", (err) => console.error("Redis error:", err));
  redisClient.on("connect", () => console.log("Connected to Redis"));

  await redisClient.connect();
  console.log("Redis is ready");
}

export { redisClient };
