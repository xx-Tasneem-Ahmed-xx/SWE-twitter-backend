import { Router } from "express";
import { TweetController } from "@/api/controllers/tweets/tweets";
const router = Router();
const tweetController = new TweetController();

router.route("/").post(tweetController.createTweet);

router
  .route("/:id")
  .get(tweetController.getTweet)
  .patch(tweetController.updateTweet)
  .delete(tweetController.deleteTweet);

router
  .route("/:id/retweet")
  .post(tweetController.createReTweet)
  .delete(tweetController.deleteRetweet);

router.route("/:id/quote").post(tweetController.createQuote);

router.route("/:id/reply").post(tweetController.createReply);
export default router;
