// GeoGuard.ts
import * as utils from "../utils/utils.js";
import { Request, Response, NextFunction } from "express";
import { GeoData } from "../utils/utils.js"; // Importing GeoData type from utils

// Custom request interface to safely access IP properties
interface RequestWithIP extends Request {
  ip?: string;
  connection?: {
    remoteAddress?: string;
  };
  socket?: {
    remoteAddress?: string;
  };
}

/**
 * GeoGurd (GeoGuard) middleware
 * - Uses utils.Sendlocation(remoteAddr) helper
 * - Blocks requests from Ukraine or Russia (same message as Go)
 */
export default function GeoGurd() {
  return async function (req: RequestWithIP, res: Response, next: NextFunction): Promise<void | Response> {
    try {
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