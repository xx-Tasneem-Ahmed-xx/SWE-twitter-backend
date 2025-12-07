import {
  InteractionsCursorServiceSchema,
  TweetCursorServiceSchema,
  UpdateTweetServiceSchema,
} from "@/application/dtos/tweets/service/tweets.dto.schema";
import {
  CreateTweetDTOSchema,
  SearchDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { Request, Response, NextFunction } from "express";
import * as responseUtils from "@/application/utils/response.utils";
import tweetService from "@/application/services/tweets";
import { encoderService } from "@/application/services/encoder";

export class TweetController {
  async createTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = CreateTweetDTOSchema.parse(req.body);
      const userId = (req as any).user.id;
      const tweet = await tweetService.createTweet({
        ...parsedData,
        userId: userId,
      });
      res.status(201).json(tweet);
    } catch (error) {
      next(error);
    }
  }

  async createReTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      await tweetService.createRetweet({
        parentId,
        userId: userId,
      });
      return responseUtils.sendResponse(res, "RETWEET_CREATED");
    } catch (error) {
      next(error);
    }
  }

  async createQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = CreateTweetDTOSchema.parse(req.body);
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      const quote = await tweetService.createQuote({
        ...parsedData,
        userId: userId,
        parentId,
      });
      res.status(201).json(quote);
    } catch (error) {
      next(error);
    }
  }

  async createReply(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = CreateTweetDTOSchema.parse(req.body);
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      const reply = await tweetService.createReply({
        ...parsedData,
        userId: userId,
        parentId,
      });
      res.status(201).json(reply);
    } catch (error) {
      next(error);
    }
  }

  async getTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const tweet = await tweetService.getTweet(id, userId);
      res.status(200).json(tweet);
    } catch (error) {
      next(error);
    }
  }

  async deleteTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await tweetService.deleteTweet(id);
      return responseUtils.sendResponse(res, "TWEET_DELETED");
    } catch (error) {
      next(error);
    }
  }

  async getRetweets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const query = req.query;

      const decodedCursor = encoderService.decode<{
        userId: string;
        createdAt: string;
      }>(query.cursor as string);

      const parsedDTO = InteractionsCursorServiceSchema.parse({
        userId,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });
      const retweets = await tweetService.getRetweets(id, parsedDTO);
      res.status(200).json(retweets);
    } catch (error) {
      next(error);
    }
  }

  async deleteRetweet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await tweetService.deleteRetweet(userId, id);
      return responseUtils.sendResponse(res, "RETWEET_DELETED");
    } catch (error) {
      next(error);
    }
  }
  async updateTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const payload = req.body;
      const parsedPayload = UpdateTweetServiceSchema.parse({
        userId,
        ...payload,
      });
      await tweetService.updateTweet(id, parsedPayload);
      return responseUtils.sendResponse(res, "TWEET_UPDATED");
    } catch (error) {
      next(error);
    }
  }

  async getTweetRepliesOrQuotes(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const decodedCursor = encoderService.decode<{
        createdAt: string;
        id: string;
      }>(req.query.cursor as string);

      let tweetType: "REPLY" | "QUOTE";
      if (req.route.path.includes("quotes")) tweetType = "QUOTE";
      else tweetType = "REPLY";

      const parsedDTO = TweetCursorServiceSchema.parse({
        userId,
        tweetType,
        limit: req.query.limit,
        cursor: decodedCursor ?? undefined,
      });

      const replies = await tweetService.getTweetRepliesOrQuotes(id, parsedDTO);
      res.status(200).json(replies);
    } catch (error) {
      next(error);
    }
  }

  async likeTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await tweetService.likeTweet(userId, id);
      return responseUtils.sendResponse(res, "TWEET_LIKED");
    } catch (error) {
      next(error);
    }
  }

  async deleteLike(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await tweetService.deleteLike(userId, id);
      return responseUtils.sendResponse(res, "TWEET_UNLIKED");
    } catch (error) {
      next(error);
    }
  }

  async getLikers(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const query = req.query;
      const decodedCursor = encoderService.decode<{
        userId: string;
        createdAt: string;
      }>(query.cursor as string);

      const parsedDTO = InteractionsCursorServiceSchema.parse({
        userId: (req as any).user.id,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });
      const likers = await tweetService.getLikers(id, parsedDTO);
      res.status(200).json(likers);
    } catch (error) {
      next(error);
    }
  }

  async getLikedTweets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const query = req.query;

      const decodedCursor = encoderService.decode<{
        createdAt: string;
        userId: string;
      }>(query.cursor as string);

      const parsedDTO = InteractionsCursorServiceSchema.parse({
        userId,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });
      const tweets = await tweetService.getLikedTweets(parsedDTO);
      res.status(200).json(tweets);
    } catch (error) {
      next(error);
    }
  }

  async getTweetSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tweetSummary = await tweetService.getTweetSummary(id);
      res.status(200).json(tweetSummary);
    } catch (error) {
      next(error);
    }
  }

  async getUserTweets(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const query = req.query;
      const currentUserId = (req as any).user.id;

      const { id: userId } = await resolveUsernameToId(username);
      const decodedCursor = encoderService.decode<{
        createdAt: string;
        id: string;
      }>(query.cursor as string);

      const parsedDTO = TweetCursorServiceSchema.parse({
        userId,
        tweetType: query.tweetType,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });

      const tweets = await tweetService.getUserTweets(parsedDTO, currentUserId);
      res.status(200).json(tweets);
    } catch (error) {
      next(error);
    }
  }

  async getUserMedias(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const { id: userId } = await resolveUsernameToId(username);
      const decodedCursor = encoderService.decode<{
        createdAt: string;
        id: string;
      }>(req.query.cursor as string);

      const parsedDTO = TweetCursorServiceSchema.parse({
        userId,
        limit: req.query.limit,
        cursor: decodedCursor ?? undefined,
      });
      const medias = await tweetService.getUserMedias(parsedDTO);
      res.status(200).json(medias);
    } catch (error) {
      next(error);
    }
  }

  async getMentionedTweets(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const query = req.query;

      const { id: userId } = await resolveUsernameToId(username);
      const decodedCursor = encoderService.decode<{
        createdAt: string;
        id: string;
      }>(query.cursor as string);

      const parsedDTO = TweetCursorServiceSchema.parse({
        userId,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });
      const tweets = await tweetService.getMentionedTweets(parsedDTO);
      res.status(200).json(tweets);
    } catch (error) {
      next(error);
    }
  }

  async searchTweets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const payload = { ...req.query };
      const parsedPayload = SearchDTOSchema.parse(payload);
      const tweets = tweetService.searchTweets({ ...parsedPayload, userId });
      res.status(200).json(tweets);
    } catch (error) {
      next(error);
    }
  }
}
