// Auth.ts

import jwt from "jsonwebtoken";
import  prisma  from "../../database.js";
import * as utils from "../../application/utils/tweets/utils.js";
import { redisClient } from "../../config/redis.js";
import { Request, Response, NextFunction } from "express"; 
// Using utils.JwtUserPayload for type checking the payload structure
import { JwtUserPayload, GeoData } from "../../application/utils/tweets/utils.js"; 

// --- Custom Type Definitions ---

// Minimal required user structure to attach to the request
interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

// Custom properties added to the Request object by this middleware
// FIX: Removed conflicting properties (ip, connection, socket) to resolve TS error.
interface RequestWithAuth extends Request {
  user?: AuthUser;
  jti?: string;
  version?: number;
  devid?: string;
  
  // Standard Express properties (ip, connection, socket) are REMOVED
  // and will be inherited correctly from the base 'Request' type.
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
 * - Sets: req.user (partial), req.jti, req.version, req.devid
 */
export default function Auth() {
  return async function (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const header: string = req.get("Authorization") || "";
      const tokenCandidate: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
      if (!tokenCandidate) return utils.SendError(res, 401, "invaild token");

      const validationResult: { ok: boolean; payload?: JwtUserPayload; err?: Error } = utils.ValidateToken(tokenCandidate);
      const { ok, payload, err } = validationResult;
      
      if (!ok || !payload) {
        console.error("Auth validateJwt err:", err);
        return utils.SendError(res, 401, "unauthorized method");
      }

      // require version claim
      const version: number | null | undefined = payload.version ?? (payload as any).token_version ?? (payload as any).tokenVersion;
      if (version === null || version === undefined) return utils.SendError(res, 401, "you are unauthorized");

      // find user by email claim
      const email: string = payload.email;
      if (!email) return utils.SendError(res, 401, "you are unauthorized");

      // NOTE: Using 'findFirst' as a substitute for the deprecated 'findOne' used in the original JS logic.
      const user: PrismaUser | null = await (prisma.user as any).findFirst({ where: { email } });
      if (!user) return utils.SendError(res, 401, "something went wrong");

      if ((user.token_version ?? 0) !== Number(version)) {
        return utils.SendError(res, 401, "token version is old try logging in again");
      }

      // check blocklist for jti
      const jti: string | undefined = payload.jti;
      if (jti) {
        const exists: number = await redisClient.exists(`Blocklist:${jti}`);
        if (exists === 1) return utils.SendError(res, 401, "you already logged out sign in again");
        (req as any).jti = jti; // Use type assertion on req for custom properties
      } else {
        console.warn("⚠️ jti missing from JWT");
      }

      // set user info on request for handlers
      (req as any).user = { 
        id: payload.id as string, 
        username: (payload as any).Username as string, // Access Username via type assertion if needed
        email, 
        role: payload.role as string 
      };
      (req as any).version = Number(version);

      // device check
      const devid: string | undefined = payload.devid as string;
      let devinfo: DeviceRecord | null = null;
      if (devid) {
        (req as any).devid = devid;
        // NOTE: Using 'findFirst' for the deprecated 'findOne'
        devinfo = await (prisma.deviceRecord as any).findFirst({ where: { id: devid } });
        if (!devinfo) return utils.SendError(res, 500, "something went wrong");
      }

      // Geo check: compare token device city with current remote city
      // Accessing standard Express properties from the base type
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