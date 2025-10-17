import { Router } from "express";
import {
  followUser,
  unfollowUser,
  acceptFollow,
  declineFollow,
  getFollowers,
  getFollowings,
} from "@/api/controllers/user_interactions/follow";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "@/api/controllers/user_interactions/block";
import {
  muteUser,
  unmuteUser,
  getMutedUsers,
} from "@/api/controllers/user_interactions/mute";

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

router.route("/blocks/:username").post(blockUser).delete(unblockUser);
router.route("/blocks").get(getBlockedUsers);

router.route("/mutes/:username").post(muteUser).delete(unmuteUser);
router.route("/mutes").get(getMutedUsers);

export default router;
