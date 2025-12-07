import { Request, Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service";
import {
  UpdateUserProfileDTOSchema,
  SearchUserQuerySchema,
  UpdateUserProfilePhotoParamsSchema,
  UpdateUserBannerParamsSchema,
  AddFcmTokenDTOSchema,
} from "../../application/dtos/user.dto.schema";
import { OSType } from "@prisma/client";
import { AppError } from "@/errors/AppError";
import { th } from "@faker-js/faker";
const userService = new UserService();

export class UserController {
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const user = await userService.getUserProfile(username, userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      next(error);
    }
  }

  async updateUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId || userId !== id) {
        throw new AppError(
          "Forbidden: you can only update your own profile",
          403
        );
      }

      const parsedBody = UpdateUserProfileDTOSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new AppError("Invalid input data", 400);
      }

      const updatedUser = await userService.updateUserProfile(
        id,
        parsedBody.data
      );

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
      if (!userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const queryResult = SearchUserQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw new AppError("Invalid query parameters", 400);
      }

      const { query } = queryResult.data;
      const users = await userService.searchUsers(query, userId);

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
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const parsedParams = UpdateUserProfilePhotoParamsSchema.safeParse(
        req.params
      );
      if (!parsedParams.success) {
        throw new AppError("Invalid request parameters", 400);
      }

      const { mediaId } = parsedParams.data;
      const updatedUser = await userService.updateProfilePhoto(userId, mediaId);

      return res.status(200).json({
        message: "Profile picture updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      next(error);
    }
  }

  async deleteUserProfilePicture(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError("Unauthorized: user not authenticated", 401);
      }
      
      const updatedUser = await userService.deleteProfilePhoto(userId);

      return res.status(200).json({
        message: "Profile picture removed successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      next(error);
    }
  }
  async updateUserBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError("Unauthorized: user not authenticated", 401);
      }

      const parsedParams = UpdateUserBannerParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new AppError("Invalid request parameters", 400);
      }

      const { mediaId } = parsedParams.data;
      const updatedUser = await userService.updateProfileBanner(
        userId,
        mediaId
      );

      return res.status(200).json({
        message: "Profile banner updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating profile banner:", error);
      next(error);
    }
  }

  async deleteUserBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError("Unauthorized: user not authenticated", 401);
      }

      const updatedUser = await userService.deleteProfileBanner(userId);

      return res.status(200).json({
        message: "Profile banner restored to default",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error deleting profile banner:", error);
      next(error);
    }
  }

  async addFcmToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError("Unauthorized: user not authenticated", 401);
      }

      // Validate request body using Zod schema
      const parsedBody = AddFcmTokenDTOSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new AppError("Invalid request body", 400);
      }

      const { token, osType } = parsedBody.data;

      // Add token using service
      const fcmToken = await userService.addFcmToken(
        userId,
        token,
        osType as OSType
      );

      return res.status(200).json({
        message: "FCM token added successfully",
        fcmToken,
      });
    } catch (error) {
      console.error("Error adding FCM token:", error);

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
export const deleteUserProfilePicture =
  userController.deleteUserProfilePicture.bind(userController);
export const updateUserBanner =
  userController.updateUserBanner.bind(userController);
export const deleteUserBanner =
  userController.deleteUserBanner.bind(userController);
export const addFcmToken = userController.addFcmToken.bind(userController);
