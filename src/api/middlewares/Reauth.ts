import * as utils from "../../application/utils/tweets/utils";
import { redisClient } from "../../config/redis";
import { GeoData } from "../../application/utils/tweets/utils";
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/errors/AppError";

// Define the custom user object expected on the Request
interface RequestWithAuthEmail extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

/**
 * Reauth middleware
 * - Ensures req.user.email exists (Auth should set it)
 * - Checks Redis key Reauth:<email> exists, then deletes it
 * - If absent -> abort with 401
 */
export default function Reauth() {
  return async function (
    req: RequestWithAuthEmail,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract email from authenticated user
      const email: string | undefined = req.user?.email;

      if (!email) {
        throw new AppError(
          "You did not authorize your action. Please choose an authorization method",
          401
        );
      }

      // Check if the reauth key exists in Redis
      const exists: number = await redisClient.exists(`Reauth:${email}`);

      // Delete the reauth key (single-use token pattern)
      await redisClient.del(`Reauth:${email}`);

      // If key didn't exist, user hasn't completed reauth flow
      if (!exists || exists === 0) {
        throw new AppError(
          "Re-authentication required. Please verify your identity first",
          401
        );
      }

      // Reauth successful, proceed to next middleware
      next();
    } catch (err) {
      // Pass error to centralized error handler
      next(err);
    }
  };
}
