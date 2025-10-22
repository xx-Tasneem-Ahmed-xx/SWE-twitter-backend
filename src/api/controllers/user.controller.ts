import { Request, Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service";

const userService = new UserService();

export class UserController {
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      // const userId = (req as any).user?.id;

      // if (!userId)
      //   return res.status(401).json({ message: "Unauthorized access" });

      const user = await userService.getUserProfile(username);

      if (!user) return res.status(404).json({ message: "User not found" });

      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      next(error);
    }
  }

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

  async updateUserProfilePicture(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId || userId !== id) {
        return res.status(403).json({
          message: "Forbidden: you can only update your own profile picture",
        });
      }

      const { photoUrl } = req.body;
      if (!photoUrl) {
        return res.status(400).json({ message: "Photo URL is required" });
      }

      const updatedUser = await userService.updateProfilePhoto(
        userId,
        photoUrl
      );

      return res.status(200).json({
        message: "Profile picture updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      next(error);
    }
  }
}

export const userController = new UserController();

export const getUserProfile =
  userController.getUserProfile.bind(userController);
export const updateUserProfile =
  userController.updateUserProfile.bind(userController);
export const searchUsers = userController.searchUsers.bind(userController);
export const updateUserProfilePicture =
  userController.updateUserProfilePicture.bind(userController);

//=====================================================//
// import { Request, Response, NextFunction } from "express";
// import { UserService } from "../../application/services/user.service";
// import {
//   UpdateUserProfileDTOSchema,
//   SearchUserQuerySchema,
//   UpdateUserProfilePhotoDTOSchema,
// } from "../../application/dtos/user.dto.schema";

// const userService = new UserService();

// export class UserController {
//   async getUserProfile(req: Request, res: Response, next: NextFunction) {
//     try {
//       const { username } = req.params;
//       const userId = (req as any).user?.id;

//       if (!userId) {
//         return res.status(401).json({ message: "Unauthorized access" });
//       }

//       const user = await userService.getUserProfile(username);
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       return res.status(200).json(user);
//     } catch (error) {
//       console.error("Error fetching user profile:", error);
//       next(error);
//     }
//   }

//   async updateUserProfile(req: Request, res: Response, next: NextFunction) {
//     try {
//       const { id } = req.params;
//       const userId = (req as any).user?.id;

//       if (!userId || userId !== id) {
//         return res.status(403).json({
//           message: "Forbidden: you can only update your own profile",
//         });
//       }

//       const parsedBody = UpdateUserProfileDTOSchema.safeParse(req.body);
//       if (!parsedBody.success) {
//         return res.status(400).json({
//           error: "Invalid input data",
//           details: parsedBody.error.format(),
//         });
//       }

//       const updatedUser = await userService.updateUserProfile(
//         id,
//         parsedBody.data
//       );

//       return res.status(200).json({
//         message: "Profile updated successfully",
//         user: updatedUser,
//       });
//     } catch (error) {
//       console.error("Error updating user profile:", error);
//       next(error);
//     }
//   }

//   async searchUsers(req: Request, res: Response, next: NextFunction) {
//     try {
//       const userId = (req as any).user?.id;
//       if (!userId) {
//         return res.status(401).json({ message: "Unauthorized access" });
//       }

//       const queryResult = SearchUserQuerySchema.safeParse(req.query);
//       if (!queryResult.success) {
//         return res.status(400).json({
//           error: "Invalid query parameters",
//           details: queryResult.error.format(),
//         });
//       }

//       const { query } = queryResult.data;
//       const users = await userService.searchUsers(query);

//       return res.status(200).json(users);
//     } catch (error) {
//       console.error("Error searching users:", error);
//       next(error);
//     }
//   }

//   async updateUserProfilePicture(
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ) {
//     try {
//       const { id } = req.params;
//       const userId = (req as any).user?.id;

//       if (!userId || userId !== id) {
//         return res.status(403).json({
//           message: "Forbidden: you can only update your own profile picture",
//         });
//       }

//       const parsedBody = UpdateUserProfilePhotoDTOSchema.safeParse(req.body);
//       if (!parsedBody.success) {
//         return res.status(400).json({
//           error: "Invalid photo URL",
//           details: parsedBody.error.format(),
//         });
//       }

//       const { photoUrl } = parsedBody.data;

//       const updatedUser = await userService.updateProfilePhoto(
//         userId,
//         photoUrl
//       );

//       return res.status(200).json({
//         message: "Profile picture updated successfully",
//         user: updatedUser,
//       });
//     } catch (error) {
//       console.error("Error updating profile picture:", error);
//       next(error);
//     }
//   }
// }

// export const userController = new UserController();

// export const getUserProfile =
//   userController.getUserProfile.bind(userController);
// export const updateUserProfile =
//   userController.updateUserProfile.bind(userController);
// export const searchUsers = userController.searchUsers.bind(userController);
// export const updateUserProfilePicture =
//   userController.updateUserProfilePicture.bind(userController);
