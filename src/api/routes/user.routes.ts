import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  updateUserProfilePicture,
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
  "/:id/profile-picture",
  ensureOwner("id"),
  updateUserProfilePicture
);

export default router;
