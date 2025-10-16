// Reauth.ts
import * as utils from "../../application/utils/tweets/utils";
import { redisClient } from "../../config/redis";
import { GeoData } from "../../application/utils/tweets/utils"; // <-- FIX: Import GeoData

import { Request, Response, NextFunction } from "express";

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
 * - If absent -> abort with 401 (same behavior as Go)
 */
export default function Reauth() {
  return async function (req: RequestWithAuthEmail, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const email: string | undefined = req.user?.email;
      if (!email) {
        return res.status(401).json("you didnot authorize your action choose authorization method");
      }

      // Check if the key exists in Redis
      const exists: number = await redisClient.exists(`Reauth:${email}`);
      
      // attempt to delete the key whether it exists or not
      // Note: Node Redis clients' `del` usually returns the number of keys deleted (0 or 1 here)
      await redisClient.del(`Reauth:${email}`); 

      if (!exists || exists === 0) {
        return res.status(401).json("you didnot authorize your action choose authorization method");
      }

      next();
    } catch (err) {
      console.error("Reauth middleware error:", err);
      // NOTE: Original used `res.status(500).json("something went wrong")` instead of `utils.SendError`
      return res.status(500).json("something went wrong");
    }
  };
}