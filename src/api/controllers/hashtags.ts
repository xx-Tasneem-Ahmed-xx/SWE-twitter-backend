import { Request, Response, NextFunction } from "express";
import { HashtagTweetsQuerySchema } from "@/application/dtos/trends/trend.dto.schema";
import { TrendCategory } from "@/application/utils/hashtag.utils";
import {
  fetchTrends,
  fetchHashtagTweets,
  fetchCategoryData,
  fetchAllCategoriesData,
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
    const category = TrendCategory.Global;
    const rawQuery = (req.query.q ?? req.query.query) as string | undefined;
    const trends = await fetchTrends(rawQuery, category, limit);
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
    const currentUserId = (req as any).user?.id ?? null;

    // Decode the hashtag ID
    const hashtagId = encoderService.decode<string>(id);
    if (!hashtagId) {
      throw new Error("Invalid hashtag ID");
    }

    const queryResult = HashtagTweetsQuerySchema.safeParse(req.query);
    if (!queryResult.success) throw queryResult.error;
    const { cursor, limit } = queryResult.data;

    // Decode cursor into a composite shape { id, createdAt }
    const decodedCursor = encoderService.decode<{
      id: string;
      createdAt: string;
    }>(cursor);

    const tweets = await fetchHashtagTweets(
      hashtagId,
      currentUserId,
      decodedCursor ?? null,
      limit
    );
    res.json(tweets);
  } catch (error) {
    next(error);
  }
};

export const getCategoriesData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id ?? null;
    const categoryQuery = req.query.category as string | undefined;

    const response = categoryQuery
      ? await fetchCategoryData(categoryQuery, userId)
      : await fetchAllCategoriesData(userId);

    res.json(response);
  } catch (error) {
    next(error);
  }
};
