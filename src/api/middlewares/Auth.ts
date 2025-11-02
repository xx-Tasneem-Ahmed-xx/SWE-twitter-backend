import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../database";
import * as utils from "../../application/utils/tweets/utils";
import { redisClient } from "../../config/redis";
import { JwtUserPayload, GeoData } from "../../application/utils/tweets/utils";

// --- Custom Type Definitions ---
interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
}


interface RequestWithAuth extends Request {
  user?: AuthUser;
  jti?: string;
  version?: number;
  devid?: string;
}

interface PrismaUser {
  tokenVersion?: number | null;
  email: string;
}

interface DeviceRecord {
  id: number;
  City?: string | null;
}

/**
 * Auth middleware
 * Expects Authorization: Bearer <token>
 * Sets req.user, req.jti, req.version, req.devid
 */
export default function Auth() {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      console.log("🟢 Auth middleware entry for:", req.originalUrl);

      const header: string = req.get("Authorization") || "";
      const tokenCandidate: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
      if (!tokenCandidate) return utils.SendError(res, 401, "invalid token");

      const validationResult: { ok: boolean; payload?: JwtUserPayload; err?: Error } = utils.ValidateToken(tokenCandidate);
      const { ok, payload, err } = validationResult;
      if (!ok || !payload) {
        console.error("Auth validateJwt err:", err);
        return utils.SendError(res, 401, "unauthorized method");
      }

      const version: number | null | undefined = payload.version ?? (payload as any).tokenVersion;
      if (version === null || version === undefined) return utils.SendError(res, 401, "unauthorized");

      const email: string = payload.email;
      if (!email) return utils.SendError(res, 401, "unauthorized");

      const user: PrismaUser | null = await (prisma.user as any).findFirst({ where: { email } });
      if (!user) return utils.SendError(res, 401, "user not found");

      if ((user.tokenVersion ?? 0) !== Number(version)) {
        return utils.SendError(res, 401, "token version is old, log in again");
      }

      const jti: string | undefined = payload.jti;
      if (jti) {
        const exists: number = await redisClient.exists(`Blocklist:${jti}`);
        if (exists === 1) return utils.SendError(res, 401, "you already logged out, sign in again");
        (req as RequestWithAuth).jti = jti;
      }

      (req as RequestWithAuth).user = {
        id: payload.id as string,
        username: (payload as any).Username as string,
        email,
        role: payload.role as string
      };
      (req as RequestWithAuth).version = Number(version);

      const devid: string | undefined = payload.devid as string;
      let devinfo: DeviceRecord | null = null;
      if (devid) {
        (req as RequestWithAuth).devid = devid;
        devinfo = await (prisma.deviceRecord as any).findFirst({ where: { id: devid } });
        if (!devinfo) return utils.SendError(res, 500, "device not found");
      }

      const remoteAddr: string | undefined = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      const date: GeoData | null = await utils.Sendlocation(remoteAddr).catch(() => null);
      if (devinfo && date?.City && devinfo.City && date.City !== devinfo.City) {
        return utils.SendError(res, 401, "your city changed, please log in again");
      }

      next();
    } catch (e) {
      console.error("Auth middleware error:", e);
      return utils.SendError(res, 500, "something went wrong");
    }
  };
}