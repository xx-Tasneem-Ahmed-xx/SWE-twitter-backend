import { AppError } from "@/errors/AppError";

export function encode<T>(data: T): string {
  try {
    const json = JSON.stringify(data);
    return Buffer.from(json, "utf-8").toString("base64url");
  } catch (err) {
    throw new AppError("Failed to encode data", 400);
  }
}

export function decode<T>(encoded: string | null | undefined): T | null {
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch (err) {
    throw new AppError("Failed to decode data", 400);
  }
}
