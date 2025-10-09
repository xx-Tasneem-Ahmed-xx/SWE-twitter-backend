import { Router } from "express";
import {
  followUser,
  unfollowUser,
  acceptFollow,
  declineFollow,
} from "../controllers/user_interactions/follow";

const router = Router();

router
  .route("/follow-requests/:username")
  .post(followUser)
  .delete(unfollowUser);
router
  .route("/follow-responses/:username")
  .patch(acceptFollow)
  .delete(declineFollow);

export default router;
