import { Router } from "express";
import { TweetController } from "@/api/controllers/tweets/tweets";
import { validateBody } from "@/api/validators/tweets/tweets.validators";
import { CreateTweetDTOSchema } from "@/application/dtos/tweets/tweet.dto.schema";
const router = Router();
const tweetController = new TweetController();

router
  .route("/")
  .post(validateBody(CreateTweetDTOSchema), tweetController.createTweet);

router.route("/likedtweets").get(tweetController.getLikedTweets);

router.route("/timeline").get(tweetController.getTimeline);

router
  .route("/:id")
  .get(tweetController.getTweet)
  .patch(tweetController.updateTweet)
  .delete(tweetController.deleteTweet);

router
  .route("/:id/retweets")
  .get(tweetController.getRetweets)
  .post(tweetController.createReTweet)
  .delete(tweetController.deleteRetweet);

router
  .route("/:id/quotes")
  .post(validateBody(CreateTweetDTOSchema), tweetController.createQuote);

router
  .route("/:id/replies")
  .get(tweetController.getTweetReplies)
  .post(validateBody(CreateTweetDTOSchema), tweetController.createReply);

router
  .route("/:id/likes")
  .get(tweetController.getLikers)
  .post(tweetController.likeTweet)
  .delete(tweetController.deleteLike);

router.route("/:id/summary").get(tweetController.getTweetSummary);

export default router;
