import { Request, Response, NextFunction } from "express";
import { HashtagTweetsQuerySchema } from "@/application/dtos/trends/trend.dto.schema";
import {
  fetchTrends,
  fetchHashtagTweets,
} from "@/application/services/hashtags";
import { encoderService } from "@/application/services/encoder";

export const getTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 30;
    const rawQuery = (req.query.q ?? req.query.query) as string | undefined;
    const trends = await fetchTrends(limit, rawQuery);
    res.json(trends);
  } catch (error) {
    next(error);
  }
};

export const getHashtagTweets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Decode the hashtag ID
    const hashtagId = encoderService.decode<string>(id);
    if (!hashtagId) {
      throw new Error("Invalid hashtag ID");
    }

    const queryResult = HashtagTweetsQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    // Decode cursor
    const decodedCursor = encoderService.decode<string>(cursor);

    const tweets = await fetchHashtagTweets(
      hashtagId,
      decodedCursor,
      limit,
      req.user?.id
    );
    res.json(tweets);
  } catch (error) {
    next(error);
  }
};
