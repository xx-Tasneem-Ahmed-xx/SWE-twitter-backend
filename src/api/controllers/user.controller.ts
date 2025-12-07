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
import * as responseUtils from "@/application/utils/response.utils";
const userService = new UserService();

export class UserController {
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        responseUtils.throwError("UNAUTHORIZED_ACCESS");
      }

      const user = await userService.getUserProfile(username, userId!);
      if (!user) {
        responseUtils.throwError("NOT_FOUND");
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
        responseUtils.throwError("FORBIDDEN_UPDATE_OWN_PROFILE");
      }

      const parsedBody = UpdateUserProfileDTOSchema.safeParse(req.body);
      if (!parsedBody.success) {
        responseUtils.throwError("INVALID_INPUT_DATA");
      }

      const updatedUser = await userService.updateUserProfile(
        id,
        parsedBody.data!
      );

      return responseUtils.sendResponse(res, "PROFILE_UPDATED", {
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
        responseUtils.throwError("UNAUTHORIZED_ACCESS");
      }

      const queryResult = SearchUserQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        responseUtils.throwError("INVALID_QUERY_PARAMETERS");
      }

      const { query } = queryResult.data!;
      const users = await userService.searchUsers(query, userId!);

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
        responseUtils.throwError("UNAUTHORIZED_ACCESS");
      }

      const parsedParams = UpdateUserProfilePhotoParamsSchema.safeParse(
        req.params
      );
      if (!parsedParams.success) {
        responseUtils.throwError("INVALID_REQUEST_PARAMETERS");
      }

      const { mediaId } = parsedParams.data!;
      const updatedUser = await userService.updateProfilePhoto(userId!, mediaId);

      return responseUtils.sendResponse(res, "PROFILE_PICTURE_UPDATED", {
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
        responseUtils.throwError("UNAUTHORIZED_USER");
      }

      const updatedUser = await userService.deleteProfilePhoto(userId!);

      return responseUtils.sendResponse(res, "PROFILE_PICTURE_REMOVED", {
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
        responseUtils.throwError("UNAUTHORIZED_USER");
      }

      const parsedParams = UpdateUserBannerParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        responseUtils.throwError("INVALID_REQUEST_PARAMETERS");
      }

      const { mediaId } = parsedParams.data!;
      const updatedUser = await userService.updateProfileBanner(
        userId!,
        mediaId
      );

      return responseUtils.sendResponse(res, "PROFILE_BANNER_UPDATED", {
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
        responseUtils.throwError("UNAUTHORIZED_USER");
      }

      const updatedUser = await userService.deleteProfileBanner(userId!);

      return responseUtils.sendResponse(res, "PROFILE_BANNER_RESTORED", {
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
        responseUtils.throwError("UNAUTHORIZED_USER");
      }

      // Validate request body using Zod schema
      const parsedBody = AddFcmTokenDTOSchema.safeParse(req.body);
      if (!parsedBody.success) {
        responseUtils.throwError("INVALID_REQUEST_BODY");
      }

      const { token, osType } = parsedBody.data!;

      // Add token using service
      const fcmToken = await userService.addFcmToken(
        userId!,
        token,
        osType as OSType
      );

      return responseUtils.sendResponse(res, "FCM_TOKEN_ADDED", {
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
