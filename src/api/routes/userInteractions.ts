import { Router } from "express";
import * as followController from "@/api/controllers/user_interactions/follow";
import * as blockController from "@/api/controllers/user_interactions/block";
import * as muteController from "@/api/controllers/user_interactions/mute";

const router = Router();

router
  .route("/followers/:username")
  .post(followController.followUser)
  .delete(followController.unfollowUser)
  .get(followController.getFollowers);
router
  .route("/followings/:username")
  .patch(followController.acceptFollow)
  .delete(followController.declineFollow)
  .get(followController.getFollowings);

router
  .route("/blocks/:username")
  .post(blockController.blockUser)
  .delete(blockController.unblockUser);
router.route("/blocks").get(blockController.getBlockedUsers);

router
  .route("/mutes/:username")
  .post(muteController.muteUser)
  .delete(muteController.unmuteUser);
router.route("/mutes").get(muteController.getMutedUsers);

export default router;
