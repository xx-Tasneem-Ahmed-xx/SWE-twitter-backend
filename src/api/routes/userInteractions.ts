import { Router } from "express";
import {
  followUser,
  unfollowUser,
  acceptFollow,
  declineFollow,
  getFollowers,
  getFollowings,
} from "@/api/controllers/user_interactions/follow";

const router = Router();

router
  .route("/followers/:username")
  .post(followUser)
  .delete(unfollowUser)
  .get(getFollowers);
router
  .route("/followings/:username")
  .patch(acceptFollow)
  .delete(declineFollow)
  .get(getFollowings);

export default router;
