import { Router } from "express";
import * as hashtagController from "@/api/controllers/hashtags";
const router = Router();

router.route("/trends").get(hashtagController.getTrends);

router.route("/categories").get(hashtagController.getCategoriesData);

router.route("/:id/tweets").get(hashtagController.getHashtagTweets);

export default router;
