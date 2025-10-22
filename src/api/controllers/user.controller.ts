import { Request, Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service";

const userService = new UserService();

export class UserController {
  // --- GET /api/users/:username ---
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const userId = (req as any).user?.id; // Authenticated user ID

      if (!userId)
        return res.status(401).json({ message: "Unauthorized access" });

      const user = await userService.getUserProfile(username);

      if (!user) return res.status(404).json({ message: "User not found" });

      // Optional: You can customize what details are shown based on who’s viewing.
      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      next(error);
    }
  }

  // --- PATCH /api/users/:id ---
  async updateUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updatedData = req.body;
      const userId = (req as any).user?.id;

      if (!userId || userId !== id)
        return res.status(403).json({
          message: "Forbidden: you can only update your own profile",
        });

      const updatedUser = await userService.updateUserProfile(id, updatedData);
      return res.status(200).json({
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      next(error);
    }
  }

  // --- GET /api/users/search?query=... ---
  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId)
        return res.status(401).json({ message: "Unauthorized access" });

      const { query } = req.query;
      if (typeof query !== "string" || !query.trim())
        return res.status(400).json({ message: "Invalid search query" });

      const users = await userService.searchUsers(query);
      return res.status(200).json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      next(error);
    }
  }
}

// Export single instance (like TweetController)
export const userController = new UserController();

// You can also export directly like before if you prefer
export const getUserProfile =
  userController.getUserProfile.bind(userController);
export const updateUserProfile =
  userController.updateUserProfile.bind(userController);
export const searchUsers = userController.searchUsers.bind(userController);
