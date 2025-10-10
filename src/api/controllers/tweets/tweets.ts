import { TweetService } from "@/application/services/tweets";
import { Console } from "console";
import { Request, Response } from "express";

const tweetService = new TweetService();

export class TweetController {
  async createTweet(req: Request, res: Response) {
    try {
      const data = req.body;
      // TODO: uncomment when auth is ready
      // const userId = (req as any).user.id;
      const userId = req.body.userId;
      const tweet = await tweetService.createTweet({ ...data, userId: userId });
      res.status(201).json(tweet);
    } catch (error) {
      res.status(400).json(`Failed to create tweet. ${error}`);
    }
  }

  async createReTweet(req: Request, res: Response) {
    try {
      const parentId = req.params.id;
      // TODO: uncomment when auth is ready
      // const userId = (req as any).user.id;
      const userId = req.body.userId;
      const retweet = await tweetService.createRetweet({
        parentId,
        userId: userId,
      });
      res.status(201).json(retweet);
    } catch (error) {
      res.status(400).json(`Failed to create retweet. ${error}`);
    }
  }

  async createQuote(req: Request, res: Response) {
    try {
      const data = req.body;
      const parentId = req.params.id;
      // TODO: uncomment when auth is ready
      // const userId = (req as any).user.id;
      const { userId } = req.body;
      const quote = await tweetService.createQuote({
        ...data,
        userId: userId,
        parentId,
      });
      res.status(201).json(quote);
    } catch (error) {
      res.status(400).json("Failed to create quote");
    }
  }

  async createReply(req: Request, res: Response) {
    try {
      const data = req.body;
      const parentId = req.params.id;
      // TODO: uncomment when auth is ready
      // const userId = (req as any).user.id;
      const { userId } = req.body;
      const reply = await tweetService.createReply({
        ...data,
        userId: userId,
        parentId,
      });
      res.status(201).json(reply);
    } catch (error) {
      res.status(400).json(`Failed to create reply. ${error}`);
    }
  }

  async getTweet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tweet = await tweetService.getTweet(id);
      res.status(200).json(tweet);
    } catch (error) {
      res.status(404).json("Tweet not found");
    }
  }

  async deleteTweet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await tweetService.deleteTweet(id);
      res.status(200).json("Tweet deleted successfuly");
    } catch (error) {
      console.log(error);
      res.status(400).json("Failed to delete tweet");
    }
  }

  async deleteRetweet(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      const { id } = req.params;
      await tweetService.deleteRetweet(userId, id);
      res.status(200).json("Retweet deleted successfuly");
    } catch (error) {
      console.log(error);
      res.status(400).json("Failed to delete Retweet");
    }
  }
  async updateTweet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      await tweetService.updateTweet(id, content);
    } catch (error) {
      res.status(404).json("Failed to update tweet");
    }
  }
}
