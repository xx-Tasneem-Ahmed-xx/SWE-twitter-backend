import crypto from "crypto";
import { AppError } from "@/errors/AppError";

class EncoderService {
  private readonly secret: string;

  constructor(secret = process.env.CURSOR_SECRET) {
    if (!secret) throw new Error("Missing cursor secret environment variable");
    this.secret = secret;
  }

  encode<T>(data: T): string {
    if (!this.secret)
      throw new Error("Missing cursor secret environment variable");
    try {
      const json = JSON.stringify(data);
      const payload = Buffer.from(json, "utf-8").toString("base64url");

      const signature = crypto
        .createHmac("sha256", this.secret)
        .update(payload)
        .digest("base64url");

      return `${payload}.${signature}`;
    } catch (err) {
      throw new AppError("Failed to encode data", 400);
    }
  }

  decode<T>(token: string | null | undefined): T | null {
    if (!token) return null;
    if (!this.secret)
      throw new Error("Missing cursor secret environment variable");

    try {
      const [payload, signature] = token.split(".");
      if (!payload || !signature)
        throw new AppError("Invalid token format", 400);

      const expectedSignature = crypto
        .createHmac("sha256", this.secret)
        .update(payload)
        .digest("base64url");

      if (signature !== expectedSignature)
        throw new AppError("Invalid or tampered token", 401);

      const json = Buffer.from(payload, "base64url").toString("utf-8");
      return JSON.parse(json) as T;
    } catch (err) {
      throw new AppError("Failed to decode data", 400);
    }
  }
}
const encoderService = new EncoderService();
export default encoderService;
