// AdminAuth.ts

// Adjust the import path below if your utils file is located elsewhere
import * as utils from "../../application/utils/tweets/utils.js";
import { Request, Response, NextFunction } from "express";

// Define an interface to extend the Request object with the custom 'user' property.
// We must include 'id: string' to satisfy the existing conflicting declaration
// (which likely comes from your Auth.ts middleware or an external type declaration).
interface RequestWithUserRole extends Request {
  user?: {
    id: string; // <-- REQUIRED FIX: Added the missing 'id' property with type string
    role?: string; // Expecting role to be set by a preceding Auth middleware
    // Add other user properties here if necessary (e.g., email, username)
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