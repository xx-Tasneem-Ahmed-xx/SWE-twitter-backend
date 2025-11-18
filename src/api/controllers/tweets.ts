import {
  BaseCursorSchema,
  CursorServiceSchema,
} from "@/application/dtos/tweets/service/tweets.dto.schema";
import { SearchDTOSchema } from "@/application/dtos/tweets/tweet.dto.schema";
import { resolveUsernameToId } from "@/application/utils/tweets/utils";
import { Request, Response, NextFunction } from "express";
import tweetService from "@/application/services/tweets";
import encoderService from "@/application/services/encoder";

export class TweetController {
  async createTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const userId = (req as any).user.id;
      const tweet = await tweetService.createTweet({ ...data, userId: userId });
      res.status(201).json(tweet);
    } catch (error) {
      next(error);
    }
  }

  async createReTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      const retweet = await tweetService.createRetweet({
        parentId,
        userId: userId,
      });
      res.status(201).json(retweet);
    } catch (error) {
      next(error);
    }
  }

  async createQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      const quote = await tweetService.createQuote({
        ...data,
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
      const data = req.body;
      const parentId = req.params.id;
      const userId = (req as any).user.id;
      const reply = await tweetService.createReply({
        ...data,
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
      res.status(200).json("Tweet deleted successfuly");
    } catch (error) {
      next(error);
    }
  }

  async getRetweets(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const query = req.query;

      const decodedCursor = encoderService.decode<{
        userId: string;
        limit: string;
      }>(query.cursor as string);

      const parsedDTO = BaseCursorSchema.parse({
        decodedCursor,
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
      res.status(200).json("Retweet deleted successfuly");
    } catch (error) {
      next(error);
    }
  }
  async updateTweet(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      await tweetService.updateTweet(id, content);
      res.status(200).json("Tweet updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async getTweetReplies(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const replies = await tweetService.getTweetReplies(id);
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
      res.status(200).json("Tweet liked successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteLike(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await tweetService.deleteLike(userId, id);
      res.status(200).json("Tweet unliked successfully");
    } catch (error) {
      next(error);
    }
  }

  async getLikers(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const likers = await tweetService.getLikers(id);
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
        lastActivityAt: string;
        id: string;
      }>(query.cursor as string);

      const parsedDTO = CursorServiceSchema.parse({
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

      const { id: userId } = await resolveUsernameToId(username);
      const decodedCursor = encoderService.decode<{
        lastActivityAt: string;
        id: string;
      }>(query.cursor as string);

      const parsedDTO = CursorServiceSchema.parse({
        userId,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
      });

      const tweets = await tweetService.getUserTweets(parsedDTO);
      res.status(200).json(tweets);
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
        lastActivityAt: string;
        id: string;
      }>(query.cursor as string);

      const parsedDTO = CursorServiceSchema.parse({
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
