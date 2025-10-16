import {Router} from "express";
import { addMediaTotweet, getTweetMedia } from "../controllers/mediaController";
const router = Router();


router.post("/:tweetId/addMediaToTweet", addMediaTotweet)
router.get("/:tweetId/getTweetMedia", getTweetMedia)

export default router;