import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  updateUserProfilePicture,
  deleteUserProfilePicture,
  updateUserBanner,
  deleteUserBanner,
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
  // ensureOwner("id"),       // TODO WHEN AUTH WORKS
  updateUserProfile
);

router.patch(
  "/profile-picture/:mediaId",
  // ensureOwner("id"),       // TODO WHEN AUTH WORKS
  updateUserProfilePicture
);
router.delete(
  "/profile-picture",
  // ensureOwner("id"), // TODO WHEN AUTH WORKS
  deleteUserProfilePicture
);
router.patch(
  "/banner/:mediaId",
  // ensureOwner("id"), // TODO WHEN AUTH WORKS
  updateUserBanner
);
router.delete(
  "/banner",
  // ensureOwner("id"), // TODO WHEN AUTH WORKS
  deleteUserBanner
);

export default router;
