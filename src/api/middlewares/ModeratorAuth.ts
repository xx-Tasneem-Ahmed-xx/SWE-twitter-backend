// ModeratorAuth.ts

import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

// --- Type Definitions for Context ---

// Assuming types for imported objects from "../controller/user.js"
// You must import/declare these in your actual project structure.
declare const redisClient: {
  exists: (key: string) => Promise<number>;
  // Add other methods if used
};
declare const sendError: (res: Response, status: number, message: string) => Response | void;

// Define the expected structure of the decoded JWT payload
interface AuthPayload extends JwtPayload {
  id: string;
  Username?: string;
  username?: string;
  email: string;
  role: string;
  jti?: string;
}

// Define the user object attached to the request
interface AuthUser {
  id: string;
  Username?: string;
  username?: string;
  email: string;
  role: string;
}

// Custom request interface to include the user object
interface RequestWithAuthUser extends Request {
  user?: AuthUser;
}

/**
 * ModeratorAuth middleware
 * - Validates Authorization header token
 * - Checks blocklist for jti
 * - Ensures token isn't expired and sets req.user fields (id, username, email, role)
 * - Finally ensures role === "moderator"
 *
 * This mirrors the Go logic (explicit token parsing inside middleware)
 */
export default function ModeratorAuth() {
  return async function (req: RequestWithAuthUser, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const header: string | undefined = req.get("Authorization");
      if (!header) return sendError(res, 401, "no Authorization header");

      const tokenString: string | null = header.startsWith("Bearer") ? header.slice(6).trim() : null;
      if (!tokenString) return sendError(res, 401, "no valid token exist");

      const secret: string = process.env.JWT_SECRET as string;
      let payload: AuthPayload;
      try {
        // Use AuthPayload type for verification result
        payload = jwt.verify(tokenString, secret) as AuthPayload;
      } catch (err) {
        console.error("ModeratorAuth jwt verify error:", err);
        return sendError(res, 401, "invlaid token signuture");
      }

      // check blocklist
      if (payload?.jti) {
        const exists: number = await redisClient.exists(`Blocklist:${payload.jti}`);
        if (exists === 1) return sendError(res, 401, "you already logged out siginin again");
      }

      // set request fields
      req.user = {
        id: payload.id,
        // Use the original logic to prefer Username, then fallback to username
        Username: payload.Username ?? payload.username, 
        email: payload.email, 
        role: payload.role 
      };

      // role must be moderator
      const role: string | undefined = req.user?.role;
      if (!role || role !== "moderator") return sendError(res, 401, "only moderator can enter this section");

      next();
    } catch (err) {
      console.error("ModeratorAuth error:", err);
      return sendError(res, 500, "something went wrong");
    }
  };
}