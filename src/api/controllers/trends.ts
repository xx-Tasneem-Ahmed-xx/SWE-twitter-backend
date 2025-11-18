import { Request, Response, NextFunction } from "express";
import { TrendQuerySchema } from "@/application/dtos/trends/trend.dto.schema";
import { fetchTrends, fetchTrendTweets } from "@/application/services/trends";
import encoderService from "@/application/services/encoder";

export const getTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 30;
    const trends = await fetchTrends(limit);
    res.json(trends);
  } catch (error) {
    next(error);
  }
};

export const getTrendTweets = async (
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

    const queryResult = TrendQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    // Decode cursor
    const decodedCursor = encoderService.decode<string>(cursor);

    const tweets = await fetchTrendTweets(hashtagId, decodedCursor, limit);
    res.json(tweets);
  } catch (error) {
    next(error);
  }
};
