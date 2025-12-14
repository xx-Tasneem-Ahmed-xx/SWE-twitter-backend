import { prisma } from "@/prisma/client";
import {
  CategoryCursorDTO,
  ExploreServiceDTO,
  PreferredCategorieDTO,
} from "@/application/dtos/explore/explore.dto";
import {
  checkUserInteractions,
  tweetSelectFields,
  updateCursor,
} from "@/application/utils/tweet.utils";
import { PreferredCategoriesSchema } from "../dtos/explore/explore.dto.schema";
import {
  GLOBAL_FEED_KEY,
  CATEGORY_FEED_KEY,
  BATCH_SIZE,
} from "@/background/constants";
import * as responseUtils from "@/application/utils/response.utils";
import { redisClient } from "@/config/redis";
import { encoderService } from "./encoder";

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

  async getUserPreferredCategories(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredCategories: { select: { name: true } } },
    });
    if (!user) responseUtils.throwError("NOT_FOUND");
    return user;
  }

  async calculateTweetScore(tweetId: string) {
    const W_LIKES = 0.2;
    const W_RETWEETS = 0.5;
    const W_QUOTES = 0.5;
    const W_REPLIES = 0.3;
    const TAU_HOURS = 48;
    const TOP_N = 10000;

    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      select: {
        tweetType: true,
        createdAt: true,
        likesCount: true,
        retweetCount: true,
        quotesCount: true,
        repliesCount: true,
        tweetCategories: { select: { category: { select: { name: true } } } },
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
    if (tweet.tweetType === "REPLY") return;
    await redisClient.zAdd(GLOBAL_FEED_KEY, {
      score,
      value: tweetId,
    });
    await redisClient.zRemRangeByRank(GLOBAL_FEED_KEY, 0, -(TOP_N + 1));
    for (const tc of tweet.tweetCategories) {
      const key = CATEGORY_FEED_KEY(tc.category.name);
      await redisClient.zAdd(key, { score, value: tweetId });
      await redisClient.zRemRangeByRank(key, 0, -(TOP_N + 1));
    }
  }

  async refreshCategoryFeed(categoryName: string, pipelineSize = 1000) {
    const key = CATEGORY_FEED_KEY(categoryName);
    await redisClient.del(key);

    let offset = 0;
    while (true) {
      const tweets = await prisma.tweet.findMany({
        where: {
          tweetCategories: { some: { category: { name: categoryName } } },
        },
        select: { id: true, score: true },
        orderBy: { score: "desc" },
        skip: offset,
        take: pipelineSize,
      });

      if (!tweets.length) break;

      for (const t of tweets) {
        await redisClient.zAdd(key, { score: t.score, value: t.id });
      }
      offset += tweets.length;
    }
  }

  async getFeed(dto: ExploreServiceDTO) {
    const { userId, category, limit = 20 } = dto;
    let cursor = dto.cursor ?? 0;
    const key = category ? CATEGORY_FEED_KEY(category) : GLOBAL_FEED_KEY;
    const BATCH_SIZE = 200;

    const resultIds = await this.collectAllowedTweetIds(
      userId,
      key,
      cursor,
      limit,
      BATCH_SIZE
    );

    if (!resultIds.length) {
      return { data: [], cursor: cursor + resultIds.length };
    }

    const hydrated = await this.hydrateTweets(userId, resultIds);
    const nextCursor =
      resultIds.length < limit
        ? null
        : encoderService.encode(cursor + resultIds.length);

    return {
      data: hydrated,
      cursor: nextCursor,
    };
  }

  private async collectAllowedTweetIds(
    userId: string,
    key: string,
    startIndex: number,
    limit: number,
    batchSize: number
  ): Promise<string[]> {
    const resultIds: string[] = [];
    let readIndex = startIndex;

    while (resultIds.length < limit) {
      const end = readIndex + batchSize - 1;
      const batchIds = await redisClient.zRange(key, readIndex, end, {
        REV: true,
      });
      if (!batchIds?.length) break;

      const allowed = await this.filterNegativeSignals(userId, batchIds);

      for (const id of batchIds) {
        if (allowed.has(id)) {
          resultIds.push(id);
          if (resultIds.length >= limit) break;
        }
      }

      readIndex += batchIds.length;
      if (batchIds.length < batchSize) break;
    }

    return resultIds;
  }

  private async hydrateTweets(userId: string, ids: string[]) {
    const tweetsRaw = await prisma.tweet.findMany({
      where: { id: { in: ids } },
      select: { ...tweetSelectFields(userId), score: true },
    });

    const tweetMap = new Map<string, any>();
    tweetsRaw.forEach((t) => tweetMap.set(t.id, t));

    const ordered = ids.map((id) => tweetMap.get(id)).filter(Boolean);

    return checkUserInteractions(ordered);
  }

  private async filterNegativeSignals(userId: string, tweetIds: string[]) {
    const tweets = await prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
        AND: [
          { user: { blocked: { none: { blockerId: userId } } } },
          { user: { muted: { none: { muterId: userId } } } },
          { notInteresteds: { none: { userId: userId } } },
          { spamReports: { none: { reporterId: userId } } },
        ],
      },
      select: {
        id: true,
      },
    });

    const allowed = new Set<string>();
    for (const t of tweets) {
      allowed.add(t.id);
    }
    return allowed;
  }

  async seedExploreCache(tweetIds: string[]) {
    for (let i = 0; i < tweetIds.length; i += BATCH_SIZE) {
      const batch = tweetIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((id) => this.calculateTweetScore(id)));
    }

    console.log(`Seeded ${tweetIds.length} tweets into explore feeds`);
  }
}