import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  updateUserProfilePicture,
  deleteUserProfilePicture,
  updateUserBanner,
  deleteUserBanner,
  addFcmToken,
} from "../controllers/user.controller";
import { ensureOwner } from "../middlewares/ensureOwner.middleware";
import { updateUserValidator } from "../validators/user.validator";
import { validateRequest } from "../middlewares/validateRequest.middleware";

const router = Router();

router.get("/search", searchUsers);
router.get("/:username", getUserProfile);

router.patch(
  "/:id",
  updateUserValidator,
  validateRequest,
  ensureOwner("id"),
  updateUserProfile
);

router.patch(
  "/profile-picture/:userId/:mediaId",
  ensureOwner("userId"),
  updateUserProfilePicture
);
router.delete(
  "/profile-picture/:userId",
  ensureOwner("userId"),
  deleteUserProfilePicture
);
router.patch(
  "/banner/:userId/:mediaId",
  ensureOwner("userId"),
  updateUserBanner
);
router.delete(
  "/banner/:userId",
  ensureOwner("userId"),
  deleteUserBanner
);
router.post("/fcm-token",addFcmToken);

export default router;
