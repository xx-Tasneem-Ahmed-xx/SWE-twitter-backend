// Auth.ts

import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import * as utils from "../utils/utils.js";
import { redisClient } from "../config/redis.js";
import { Request, Response, NextFunction } from "express"; // Import Express types
// Using utils.JwtUserPayload for type checking the payload structure
import { JwtUserPayload, GeoData } from "../utils/utils.js"; // Adjust path as necessary

// --- Custom Type Definitions ---

// Minimal required user structure to attach to the request
interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

// Custom properties added to the Request object by this middleware
interface RequestWithAuth extends Request {
  user?: AuthUser;
  jti?: string;
  version?: number;
  devid?: number;
  // Express has req.ip, req.connection.remoteAddress, req.socket.remoteAddress
  ip?: string;
  connection?: {
    remoteAddress?: string;
  };
  socket?: {
    remoteAddress?: string;
  };
}

// Minimal Prisma User structure for database read (assuming this structure)
interface PrismaUser {
    token_version?: number | null; // Can be null in DB
    email: string;
}

// Minimal Prisma DeviceRecord structure
interface DeviceRecord {
    id: number;
    City?: string | null;
}

/**
 * Auth middleware
 * - Expects Authorization: Bearer <token>
 * - Validates JWT signature & expiry via utils.ValidateToken
 * - Checks token jti against Redis Blocklist
 * - Checks token version matches DB user's token_version
 * - Loads devinfo from DeviceRecord and checks city hasn't changed
 * - Sets: req.user (partial), req.jti, req.version, req.devid
 */
export default function Auth() {
  return async function (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const header: string = req.get("Authorization") || "";
      const tokenCandidate: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
      if (!tokenCandidate) return utils.SendError(res, 401, "invaild token");

      // Assuming utils.ValidateToken returns { ok: boolean, payload?: JwtUserPayload, err?: Error }
      const validationResult: { ok: boolean; payload?: JwtUserPayload; err?: Error } = utils.ValidateToken(tokenCandidate);
      const { ok, payload, err } = validationResult;
      
      if (!ok || !payload) {
        console.error("Auth validateJwt err:", err);
        return utils.SendError(res, 401, "unauthorized method");
      }

      // require version claim
      // Accessing optional claims using the union operator for compatibility
      const version: number | null | undefined = payload.version ?? (payload as any).token_version ?? (payload as any).tokenVersion;
      if (version === null || version === undefined) return utils.SendError(res, 401, "you are unauthorized");

      // find user by email claim
      const email: string = payload.email;
      if (!email) return utils.SendError(res, 401, "you are unauthorized");

      // NOTE: Original used `prisma.User.findOne`. Prisma Client V2+ uses `findUnique` or `findFirst`. 
      // Assuming you intended `findUnique` if email is unique.
      const user: PrismaUser | null = await (prisma.user as any).findOne({ where: { email } });
      if (!user) return utils.SendError(res, 401, "something went wrong");

      // Type assertion is needed here because the version might be null in DB
      if ((user.token_version ?? 0) !== Number(version)) {
        return utils.SendError(res, 401, "token version is old try logging in again");
      }

      // check blocklist for jti
      const jti: string | undefined = payload.jti;
      if (jti) {
        const exists: number = await redisClient.exists(`Blocklist:${jti}`);
        if (exists === 1) return utils.SendError(res, 401, "you already logged out sign in again");
        req.jti = jti;
      } else {
        // jti missing — continue but warn
        console.warn("⚠️ jti missing from JWT");
      }

      // set user info on request for handlers
      req.user = { id: payload.id as number, username: payload.Username as string, email, role: payload.role as string };
      req.version = Number(version);

      // device check
      const devid: number | undefined = payload.devid as number;
      let devinfo: DeviceRecord | null = null;
      if (devid) {
        req.devid = Number(devid);
        // NOTE: Original used `prisma.deviceRecord.findOne`. Assuming `findUnique` is intended.
        devinfo = await (prisma.deviceRecord as any).findOne({ where: { id: Number(devid) } });
        if (!devinfo) return utils.SendError(res, 500, "something went wrong");
      }

      // Geo check: compare token device city with current remote city
      const remoteAddr: string | undefined = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      const date: GeoData | null = await utils.Sendlocation(remoteAddr).catch(() => null);
      
      if (devinfo && date?.City && devinfo.City && date.City !== devinfo.City) {
        return utils.SendError(res, 401, "your city that was logged has changed u must log in again");
      }

      next();
    } catch (e) {
      console.error("Auth middleware error:", e);
      return utils.SendError(res, 500, "something went wrong");
    }
  };
}