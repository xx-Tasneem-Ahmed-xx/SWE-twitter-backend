import { Router } from "express";
import { getTrends, getTrendTweets } from "@/api/controllers/trends";

const router = Router();

router.route("/").get(getTrends);
router.route("/:id/tweets").get(getTrendTweets);

export default router;
