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

router.get("/search", searchUsers);
router.get("/:username", getUserProfile);



router.patch(
  "/:id",
  requireAuth,
  updateUserValidator,
  validateRequest,
  ensureOwner("id"),
  updateUserProfile
);



export default router;
