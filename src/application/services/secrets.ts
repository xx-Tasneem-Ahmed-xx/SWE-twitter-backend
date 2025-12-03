import dotenv from "dotenv";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { AppError } from "@/errors/AppError";
import { redisClient } from "../../config/redis";

dotenv.config();

const REDIS_SECRET_CACHE_KEY = process.env.REDIS_SECRET_CACHE_KEY || "aws_secrets_cache_key";

// Load secrets from AWS, cache in Redis
async function loadAwsSecrets(): Promise<Record<string, string>> {
  if (!redisClient) {
    throw new AppError("Redis client not initialized. Call initRedis() first.");
  }

  const redisValue = await redisClient.get(REDIS_SECRET_CACHE_KEY);
  if (redisValue) {
    return JSON.parse(redisValue);
  }

  const secretName = process.env.AWS_MAIN_SECRET_NAME;
  if (!secretName) {
    throw new AppError("Missing AWS_MAIN_SECRET_NAME in environment variables");
  }

  const region = process.env.AWS_REGION;
  const client = new SecretsManagerClient({ region });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  const secretString =
    "SecretString" in response
      ? response.SecretString!
      : Buffer.from(response.SecretBinary as Uint8Array).toString("utf-8");

  const parsed = JSON.parse(secretString);

  // cache in Redis
  await redisClient.set(REDIS_SECRET_CACHE_KEY, JSON.stringify(parsed));

  return parsed;
}

// get a single key from AWS secrets or env
export async function getKey(key: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key];

  const awsSecrets = await loadAwsSecrets();
  return awsSecrets[key];
}

// get multiple keys
export async function getKeys<T extends Record<string, string>>(
  keys: readonly (keyof T)[]
): Promise<Partial<T>> {
  const result: Partial<T> = {};

  for (const key of keys) {
    const value = await getKey(key as string);
    if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }

  return result;
}
