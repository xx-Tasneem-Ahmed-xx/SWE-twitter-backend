// ActivateUser.ts
import { Request, Response, NextFunction } from "express";

// Assuming types for imported functions/objects from "../controller/user.js" (now .ts)
// You may need to replace these placeholder types with actual types from your controller/user.ts file.
interface DbMock {
  User: {
    update: (data: { is_active: boolean }, options: { where: { id: number } }) => Promise<[number]>;
  };
}
declare const db: DbMock;
declare const sendError: (res: Response, status: number, message: string) => Response | void;
// Assuming req.user exists and has an 'id' property set by previous middleware
interface RequestWithUser extends Request {
  user?: {
    id: number;
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
      const id: number | undefined = req.user?.id ?? (req.body && Number(req.body.id));
      if (!id) return sendError(res, 401, "unauthorized");

      // Assuming db.User.update returns Promise<[affectedCount: number]> (like Sequelize)
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