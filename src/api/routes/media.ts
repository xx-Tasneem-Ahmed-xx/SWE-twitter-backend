import {Router} from "express";
import { addMediaTotweet, getTweetMedia, requestToUploadMedia } from "../controllers/mediaController";
const router = Router();


router.post("/:tweetId/addMediaToTweet", addMediaTotweet)
router.get("/:tweetId/getTweetMedia", getTweetMedia)
router.post("/requestToUploadMedia", requestToUploadMedia)

export default router;