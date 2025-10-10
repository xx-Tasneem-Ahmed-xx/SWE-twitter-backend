import { Router } from "express";
import { TweetController } from "@/api/controllers/tweets/tweets";
import { validateBody } from "@/api/validators/tweets/tweets.validators";
import {
  CreateRetweetDTOSchema,
  CreateTweetDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
const router = Router();
const tweetController = new TweetController();

router
  .route("/")
  .post(validateBody(CreateTweetDTOSchema), tweetController.createTweet);

router
  .route("/:id")
  .get(tweetController.getTweet)
  .patch(tweetController.updateTweet)
  .delete(tweetController.deleteTweet);

router
  .route("/:id/retweet")
  .post(validateBody(CreateRetweetDTOSchema), tweetController.createReTweet)
  .delete(tweetController.deleteRetweet);

router
  .route("/:id/quote")
  .post(validateBody(CreateTweetDTOSchema), tweetController.createQuote);

router
  .route("/:id/reply")
  .post(validateBody(CreateTweetDTOSchema), tweetController.createReply);

export default router;
