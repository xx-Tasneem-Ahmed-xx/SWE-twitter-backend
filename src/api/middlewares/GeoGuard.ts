// GeoGuard.ts
// FIX: Added necessary imports from 'express' and 'GeoData' from 'utils'
import { Request, Response, NextFunction } from "express"; // <-- FIX: Import NextFunction
// import { prisma } from "../../database.js";
import * as utils from "../../application/utils/tweets/utils";
import { redisClient } from "../../config/redis";
import { GeoData } from "../../application/utils/tweets/utils"; // <-- FIX: Import GeoData

// Custom request interface to safely access IP properties
// FIX: Removed conflicting standard Express properties (ip, connection, socket)
interface RequestWithIP extends Request {
  // We rely on the base Request type for standard properties (ip, connection, socket).
  // This resolves the common TS conflict errors.
}

/**
 * GeoGurd (GeoGuard) middleware
 * - Uses utils.Sendlocation(remoteAddr) helper
 * - Blocks requests from Ukraine or Russia (same message as Go)
 */
export default function GeoGurd() {
  return async function (req: RequestWithIP, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      // Access standard properties from the base Request type
      const remoteAddr: string | undefined = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      
      // Use the imported function utils.Sendlocation
      const data: GeoData | null = await utils.Sendlocation(remoteAddr).catch(() => null); 
      
      if (!data) return utils.SendError(res, 500, "something went wrong");

      // Check both 'Country' (from GeoData interface) and 'country' (just in case of inconsistency)
      const country: string = data.Country || (data as any).country || ""; 
      
      if (country === "Ukraine" || country === "Russia") {
        // Exactly matches text from Go (intentionally explicit)
        return utils.SendError(res, 401, "users in this country cannot access my website ,fuck you");
      }
      
      next();
    } catch (err) {
      console.error("GeoGurd error:", err);
      return utils.SendError(res, 500, "something went wrong");
    }
  };
}