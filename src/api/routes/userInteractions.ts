import { Router } from "express";
import {
  followUser,
  unfollowUser,
  acceptFollow,
  declineFollow,
} from "@/api/controllers/user_interactions/follow";

const router = Router();

router
  .route("/follow-requests/:username")
  .post(followUser)
  .delete(unfollowUser);
router
  .route("/follow-responses/:followerId")
  .patch(acceptFollow)
  .delete(declineFollow);

export default router;
