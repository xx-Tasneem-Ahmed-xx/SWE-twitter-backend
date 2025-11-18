import { Request, Response, NextFunction } from "express";
import { TrendQuerySchema } from "@/application/dtos/trends/trend.dto.schema";
import { fetchTrends, fetchTrendTweets } from "@/application/services/trends";

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
    // TODO: decode id using encoder service

    const queryResult = TrendQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    // TODO: use encoder service to decode cursor

    const tweets = await fetchTrendTweets(id, cursor, limit);
    res.json(tweets);
  } catch (error) {
    next(error);
  }
};
