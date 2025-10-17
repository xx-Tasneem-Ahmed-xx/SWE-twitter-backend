import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
} from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { ensureOwner } from "../middlewares/ensureOwner.middleware";
import { updateUserValidator } from "../validators/user.validator";
import { validateRequest } from "../middlewares/validateRequest.middleware";

const router = Router();

// All profile and search endpoints require auth
router.get("/search", requireAuth, searchUsers);
router.get("/:username", requireAuth, getUserProfile);

router.patch(
  "/:id",
  requireAuth,
  updateUserValidator,
  validateRequest,
  ensureOwner("id"),
  updateUserProfile
);

export default router;
