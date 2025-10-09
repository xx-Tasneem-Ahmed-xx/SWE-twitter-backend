// src/api/routes/user.routes.ts
import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { ensureOwner } from "../middlewares/ensureOwner.middleware";
import { updateUserValidator } from "../validators/user.validator";
import { validateRequest } from "../middlewares/validateRequest.middleware";

const router = Router();

// Public profile access by username
router.get("/:username", getUserProfile);

// Protected update (must own the account)
router.patch(
  "/:id",
  requireAuth,
  updateUserValidator,
  validateRequest,
  ensureOwner("id"),
  updateUserProfile
);

export default router;
