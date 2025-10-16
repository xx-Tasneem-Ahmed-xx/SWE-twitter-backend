// ActivateUser.ts
import { Request, Response, NextFunction } from "express";

// --- Custom Type Definitions ---

// 1. Update DbMock to expect 'id' as string in the where clause
interface DbMock {
  User: {
    // 'id' is now of type string
    update: (data: { is_active: boolean }, options: { where: { id: string } }) => Promise<[number]>;
  };
}
declare const db: DbMock;
declare const sendError: (res: Response, status: number, message: string) => Response | void;

// 2. Update RequestWithUser to reflect 'id' as string
interface RequestWithUser extends Request {
  user?: {
    id: string; // Changed from number to string
    // Add other user properties here if needed
  };
}

/**
 * ActivateUser middleware
 * - Updates users.is_active = true where id = req.user.id
 * - Mirrors Go's DB call pattern
 */
export default function ActivateUser() {
  return async function (req: RequestWithUser, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      // Safely access req.user.id or req.body.id
      // We prioritize req.user.id (string) or convert req.body.id to string.
      // NOTE: Removed the 'Number()' conversion for req.body.id.
      const id: string | undefined = req.user?.id ?? (req.body && req.body.id?.toString());
      if (!id) return sendError(res, 401, "unauthorized");

      // Assuming db.User.update returns Promise<[affectedCount: number]> (like Sequelize)
      // The `id` passed to the `where` clause is now correctly a string.
      const [affected] = await db.User.update({ is_active: true }, { where: { id } });
      
      // Sequelize returns [affectedCount] for update; check 0 -> error
      if (!affected || affected === 0) {
        return sendError(res, 500, "something went wrong");
      }
      
      // Continue to next handler (Go version didn't call Next explicitly but it's middleware)
      next();
    } catch (err) {
      console.error("ActivateUser error:", err);
      return sendError(res, 500, "something went wrong");
    }
  };
}