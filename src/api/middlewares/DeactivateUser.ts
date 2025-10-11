// DeactivateUser.ts
import { prisma } from "../config/database.js";
import * as utils from "../utils/utils.js";
import { redisClient } from "../config/redis.js";
import { Request, Response, NextFunction } from "express";

// --- Type Definitions for Context ---

// Assuming `db` is still used and contains a User model with an update method,
// similar to how it was implied in your ActivateUser.js. 
// If you intended to use `prisma.user.update` directly, the code would be different, 
// but since you used `db.User.update`, I'll define a type for `db` and assume it exists 
// and that `db` is imported elsewhere in your project structure.
interface DbMock {
  User: {
    // Mimics the Sequelize update signature returning [affectedCount]
    update: (data: { is_active: boolean }, options: { where: { id: number } }) => Promise<[number]>;
  };
}
// You must declare `db` globally or import it from the correct path. 
// For conversion fidelity, I declare it to avoid changing the function body.
declare const db: DbMock; 

// Custom request interface to include the user object set by a preceding Auth middleware
interface RequestWithAuthId extends Request {
  user?: {
    id: number;
    // Add other user properties here if needed
  };
}

/**
 * DeactivateUser middleware
 * - Equivalent to ActivateUser but sets is_active = false
 */
export default function DeactivateUser() {
  return async function (req: RequestWithAuthId, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      // Safely access req.user.id or req.body.id
      const id: number | undefined = req.user?.id ?? (req.body && Number(req.body.id));
      if (!id) return utils.SendError(res, 401, "unauthorized");

      // Assuming db.User.update is available and returns [affectedCount: number]
      const [affected]: [number] = await db.User.update({ is_active: false }, { where: { id } });
      
      if (!affected || affected === 0) {
        // Fixed the typo in the original JS: uitls.SendError -> utils.SendError
        return utils.SendError(res, 500, "something went wrong");
      }
      
      next();
    } catch (err) {
      console.error("DeactivateUser error:", err);
      return utils.SendError(res, 500, "something went wrong");
    }
  };
}