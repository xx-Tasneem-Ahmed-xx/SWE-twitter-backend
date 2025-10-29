import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../database";
import * as utils from "../../application/utils/tweets/utils";
import { redisClient } from "../../config/redis";
import { JwtUserPayload, GeoData } from "../../application/utils/tweets/utils";
import { AppError } from "@/errors/AppError";

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
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get Authorization header
      const header: string = req.get("Authorization") || "";
      const tokenCandidate: string | null = header.startsWith("Bearer") 
        ? header.slice(6).trim() 
        : null;

      if (!tokenCandidate) {
        throw new AppError("Authorization token is required", 401);
      }

      // Validate JWT token
      const validationResult: { 
        ok: boolean; 
        payload?: JwtUserPayload; 
        err?: Error 
      } = utils.ValidateToken(tokenCandidate);

      const { ok, payload, err } = validationResult;

      if (!ok || !payload) {
        throw new AppError("Invalid or expired token", 401);
      }

      // Extract and validate token version
      const version: number | null | undefined = payload.version ?? (payload as any).tokenVersion;

      if (version === null || version === undefined) {
        throw new AppError("Token version is missing", 401);
      }

      // Extract and validate email
      const email: string = payload.email;

      if (!email) {
        throw new AppError("Email is missing from token", 401);
      }

      // Check if user exists in database
      const user: PrismaUser | null = await (prisma.user as any).findFirst({ 
        where: { email } 
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Verify token version matches user's current version
      if ((user.tokenVersion ?? 0) !== Number(version)) {
        throw new AppError("Token has been invalidated, please login again", 401);
      }

      // Check if token is in blocklist (revoked)
      const jti: string | undefined = payload.jti;

      if (jti) {
        const exists: number = await redisClient.exists(`Blocklist:${jti}`);

        if (exists === 1) {
          throw new AppError("Token has been revoked", 401);
        }

        (req as RequestWithAuth).jti = jti;
      }

      // Attach user information to request
      (req as RequestWithAuth).user = {
        id: payload.id as string,
        username: (payload as any).Username as string,
        email,
        role: payload.role as string
      };

      (req as RequestWithAuth).version = Number(version);

      // Handle device verification
      const devid: string | undefined = payload.devid as string;
      let devinfo: DeviceRecord | null = null;

      if (devid) {
        (req as RequestWithAuth).devid = devid;

        devinfo = await (prisma.deviceRecord as any).findFirst({ 
          where: { id: devid } 
        });

        if (!devinfo) {
          throw new AppError("Device not recognized, please re-authenticate", 403);
        }
      }

      // Verify location matches device location (if available)
      const remoteAddr: string | undefined = 
        req.ip || 
        req.connection?.remoteAddress || 
        req.socket?.remoteAddress;

      const date: GeoData | null = await utils.Sendlocation(remoteAddr).catch(() => null);

      if (devinfo && date?.City && devinfo.City && date.City !== devinfo.City) {
        throw new AppError(
          "Location mismatch detected. For security reasons, please verify your identity", 
          403
        );
      }

      // Authentication successful, proceed to next middleware
      next();

    } catch (err) {
      // Pass error to centralized error handler
      next(err);
    }
  };
}