// AdminAuth.ts

import * as utils from "../utils/utils.js";
import { Request, Response, NextFunction } from "express";

// Define an interface to extend the Request object with the custom 'user' property
interface RequestWithUserRole extends Request {
  user?: {
    role?: string; // Expecting role to be set by a preceding Auth middleware
    // Add other user properties here if necessary (e.g., id, email)
  };
}

/**
 * AdminAuth middleware
 * - Checks req.user.role == "admin"
 * - Note: Should be used after Auth middleware (which sets req.user)
 */
export default function AdminAuth() {
  return function (req: RequestWithUserRole, res: Response, next: NextFunction): void | Response {
    // Safely access the role property
    const role: string | undefined = req.user?.role;
    
    if (!role || role !== "admin") {
      // Use the imported SendError from utils
      return utils.SendError(res, 401, "only admin can enter");
    }
    
    next();
  };
}