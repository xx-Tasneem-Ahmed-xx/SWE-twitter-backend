import { prisma } from "@/prisma/client";
import {
  CategoryCursorDTO,
  ExploreServiceDTO,
  PreferredCategorieDTO,
} from "@/application/dtos/explore/explore.dto";
import { updateCursor } from "@/application/utils/tweet.utils";
import tweetService from "@/application/services/tweets";
import { PreferredCategoriesSchema } from "../dtos/explore/explore.dto.schema";
import { FEED_CACHE_PREFIX, FEED_CACHE_TTL } from "@/background/jobs/explore";
import { redisClient } from "@/config/redis";

export class ExploreService {
  private static instance: ExploreService;
  private constructor() {}
  public static getInstance(): ExploreService {
    if (!ExploreService.instance) {
      ExploreService.instance = new ExploreService();
    }
    return ExploreService.instance;
  }

  async getCategories(dto: CategoryCursorDTO) {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "desc" },
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });
    const { cursor, paginatedRecords } = updateCursor(
      categories,
      dto.limit,
      (record) => ({ id: record.id })
    );
    return {
      data: paginatedRecords,
      cursor,
    };
  }

  async saveUserPreferredCategories(
    userId: string,
    dto: PreferredCategorieDTO
  ) {
    PreferredCategoriesSchema.parse(dto);
    return await prisma.user.update({
      where: { id: userId },
      data: {
        preferredCategories: {
          set: [],
          connect: dto.categories.map((name) => ({ name })),
        },
      },
      select: { id: true },
    });
  }

  async getFeed(dto: ExploreServiceDTO & { forceRefresh?: boolean }) {
    const cacheKey = `${FEED_CACHE_PREFIX}${dto.userId}${
      dto.category ? `:cat:${dto.category}` : ""
    }`;

    if (!dto.cursor && !dto.forceRefresh) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const tweets = await prisma.tweet.findMany({
      where: {
        AND: [
          { user: { blocked: { none: { blockerId: dto.userId } } } },
          { user: { muted: { none: { muterId: dto.userId } } } },
          { notInteresteds: { none: { userId: dto.userId } } },
          { spamReports: { none: { reporterId: dto.userId } } },
        ],

        ...(dto.category && {
          tweetCategories: { some: { category: { name: dto.category } } },
        }),
      },
      orderBy: [{ score: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      select: { ...tweetService.tweetSelectFields(dto.userId), score: true },
      ...(dto.cursor && {
        cursor: { id: dto.cursor.id },
        skip: 1,
      }),
    });

    const { cursor, paginatedRecords } = updateCursor(
      tweets,
      dto.limit,
      (record) => ({ id: record.id, score: record.score })
    );

    const data = tweetService.checkUserInteractions(paginatedRecords);
    const response = { data, cursor };

    if (!dto.cursor) {
      await redisClient.set(cacheKey, JSON.stringify(response), {
        EX: FEED_CACHE_TTL,
      });
    }

    return response;
  }

  async calculateTweetScore(tweetId: string) {
    const W_LIKES = 0.2;
    const W_RETWEETS = 0.5;
    const W_QUOTES = 0.5;
    const W_REPLIES = 0.3;
    const TAU_HOURS = 48;

    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      select: {
        createdAt: true,
        likesCount: true,
        retweetCount: true,
        quotesCount: true,
        repliesCount: true,
      },
    });
    if (!tweet) return;

    const ageHours =
      (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);

    const score =
      (W_LIKES * tweet.likesCount +
        W_RETWEETS * tweet.retweetCount +
        W_QUOTES * tweet.quotesCount +
        W_REPLIES * tweet.repliesCount) *
      Math.exp(-(ageHours / TAU_HOURS));

    await prisma.tweet.update({
      where: { id: tweetId },
      data: { score },
    });
  }
}
