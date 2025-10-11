// config/redis.ts
import { createClient, RedisClientType } from "redis";

// Equivalent to Go's: var Ctx = context.Background()
const Ctx: {} = {}; // Placeholder context object if you want consistency with Go naming

// Create Redis client. Explicitly set the type to RedisClientType
const redisClient: RedisClientType = createClient({
  url: "redis://localhost:6379", // matches Addr:"localhost:6379"
  // NOTE: The 'password' option is typically for connection security, 
  // but if it's intentionally empty, we keep it as is.
  password: "",                  // same as Password:""
  database: 0                    // same as DB:0
});

redisClient.on("error", (err: Error) => {
  console.error("❌ Redis connection error:", err);
  process.exit(1);
});

redisClient.on("connect", () => {
  console.log("🔌 Connected to Redis successfully");
});

export async function connectRedis(): Promise<void> {
  try {
    // The client starts disconnected, so we call connect() first
    await redisClient.connect();

    // Equivalent to Rdb.Ping(Ctx).Err()
    await redisClient.ping();

    // Equivalent to Rdb.FlushAll(Ctx).Err()
    // The original comment says "add at later", but the JS code included it, so we keep it.
    await redisClient.flushAll(); 

    console.log("🧹 Redis connected and cache cleared (FlushAll complete)");
  } catch (err) {
    console.error("❌ Something went wrong during Redis connection:", err);
    process.exit(1);
  }
}

export { redisClient, Ctx };