// AfterChange.ts

//import { prisma } from "../config/database.js";
import { getSecrets } from "@/config/secrets";
import * as utils from "../../application/utils/tweets/utils";
// Adjust path if your Sequelize models are elsewhere
import {redisClient } from "../../config/redis";
import { Request, Response, NextFunction } from "express"; // Import Express types

/**
 * AfterChange middleware
 * - Flushes all Redis keys (FlushAll) — mirrors the Go middleware
 * - Clears refresh_token cookie by setting a negative maxAge
 * - Calls next()
 *
 * WARNING: Redis FLUSHALL is destructive; keep same semantics as your Go version.
 */
const { domain } = getSecrets();
export default function AfterChange() {
  return async function (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      // NOTE: This uses the specific command name for Node Redis clients
      await redisClient.flushAll();

      // clear cookie (Express)
      res.clearCookie("refresh_token", {
        domain,
        path: "/",
      });

      next();
    } catch (err) {
      console.error("AfterChange err:", err);
      // Fixed the typo in the original JS: uitls.SendError -> utils.SendError
      return next(err);
    }
  };
}
