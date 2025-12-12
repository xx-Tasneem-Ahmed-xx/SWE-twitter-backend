// hashtagservice.ts
import { extractHashtags } from "twitter-text";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { redisClient } from "@/config/redis";
import { encoderService } from "@/application/services/encoder";
import * as utils from "@/application/utils/hashtag.utils";
import { fetchWhoToFollow } from "@/application/services/userInteractions";
import { ExploreService } from "@/application/services/explore";
import {
  checkUserInteractions,
  tweetSelectFields,
} from "@/application/utils/tweet.utils";

// Trends configuration constants
const TRENDS_CACHE_TTL = 60 * 15;
const TRENDS_LIMIT = 30;
const TREND_PERIOD_HOURS = 24;
const TREND_CACHE_KEY = (category: utils.TrendCategory) =>
  `trends:category:${category.toLowerCase()}`;

// Extracts and normalizes hashtags from text
export function extractAndNormalizeHashtags(text?: string | null): string[] {
  if (!text) return [];
  const rawTags = extractHashtags(text) || [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of rawTags) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase();
    if (!tag || tag.length > 100) continue;
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
}

// Find existing hashes
export async function findExistingHashes(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags.length) return [];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Create missing hashes in batch
export async function createMissingHashes(
  tx: Prisma.TransactionClient,
  missingTags: string[]
) {
  if (!missingTags.length) return;
  await tx.hash.createMany({
    data: missingTags.map((tag) => ({ tag_text: tag })),
    skipDuplicates: true,
  });
}

// Get all hashes by tags
export async function getAllHashesByTags(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags.length) return [];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Create tweet-hash relations
export async function createTweetHashRelations(
  tx: Prisma.TransactionClient,
  tweetId: string,
  hashRows: { id: string; tag_text: string }[]
) {
  if (!hashRows.length) return;
  await tx.tweetHash.createMany({
    data: hashRows.map((h) => ({ tweetId, hashId: h.id })),
    skipDuplicates: true,
  });
}

// Attach hashtags to a tweet
export async function attachHashtagsToTweet(
  tweetId: string,
  text: string | null | undefined,
  tx: Prisma.TransactionClient
) {
  if (!tweetId) throw new AppError("Server Error: tweetId is required", 500);
  if (!tx)
    throw new AppError("Server Error: transaction client is required", 500);

  const tags = extractAndNormalizeHashtags(text);
  if (!tags.length) return;

  const existing = await findExistingHashes(tx, tags);
  const existingSet = new Set(existing.map((h) => h.tag_text));

  const missing = tags.filter((t) => !existingSet.has(t));
  await createMissingHashes(tx, missing);

  const allHashes = await getAllHashesByTags(tx, tags);
  await createTweetHashRelations(tx, tweetId, allHashes);
}

// -------------------- Trends --------------------

// Calculate trends
export async function calculateTrends(
  category: utils.TrendCategory,
  options?: {
    matchingIds?: string[];
    limit?: number;
  },
  periodHours: number = TREND_PERIOD_HOURS
): Promise<utils.TrendData[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - periodHours);
  const whereClause: any = {
    tweet: {
      createdAt: { gte: cutoffDate },
      ...(category === utils.TrendCategory.Global
        ? {}
        : {
            tweetCategories: {
              some: {
                category: {
                  name: category,
                },
              },
            },
          }),
    },
  };
  if (options?.matchingIds?.length) {
    whereClause.hashId = { in: options.matchingIds };
  }
  const relations = await prisma.tweetHash.findMany({
    where: whereClause,
    select: { hashId: true, tweet: { select: { likesCount: true } } },
  });
  const agg = new Map<string, { tweetCount: number; likesSum: number }>();
  for (const r of relations) {
    const cur = agg.get(r.hashId) || { tweetCount: 0, likesSum: 0 };
    cur.tweetCount += 1;
    cur.likesSum += r.tweet?.likesCount ?? 0;
    agg.set(r.hashId, cur);
  }
  const entries = Array.from(agg.entries()).map(([hashId, v]) => ({
    hashId,
    tweetCount: v.tweetCount,
    likesSum: v.likesSum,
  }));

  if (!entries.length) return [];

  const scored = utils.calculateTrendScores(entries);
  const limited = utils.sortAndTake(scored, options?.limit ?? TRENDS_LIMIT);
  return utils.mapToTrendData(limited, prisma);
}

// Cache trends
export async function cacheTrends(
  trends: utils.TrendData[],
  category: utils.TrendCategory
) {
  if (trends.length > 0) {
    await redisClient.setEx(
      TREND_CACHE_KEY(category),
      TRENDS_CACHE_TTL,
      JSON.stringify({ trends, updatedAt: new Date().toISOString() })
    );
  } else {
    console.warn(
      `Skipping cache update for ${category} trends - no data to cache`
    );
  }
}

// Calculate & cache trends
export async function calculateAndCacheTrends(category: utils.TrendCategory) {
  const trends = await calculateTrends(category);
  await cacheTrends(trends, category);
  console.log(`Calculated & cached ${trends.length} trends for ${category}`);
}

// -------------------- fetch and worker --------------------

// Fetch tweets for a hashtag
export const fetchHashtagTweets = async (
  hashtagId: string,
  userId: string,
  cursor?: { id: string; createdAt: string } | null,
  limit: number = 30
) => {
  const hash = await prisma.hash.findUnique({ where: { id: hashtagId } });
  if (!hash) throw new AppError("Hashtag not found", 404);

  const excludedUserIds = await utils.getExcludedUserIds(userId, prisma);
  const cursorCondition = utils.buildCursorCondition(cursor);
  const tweetSelect = tweetSelectFields(userId);

  const tweetHashes = await prisma.tweetHash.findMany({
    where: {
      hashId: hash.id,
      tweet: {
        ...cursorCondition,
        ...(excludedUserIds.length > 0
          ? { userId: { notIn: excludedUserIds } }
          : {}),
      },
    },
    include: { tweet: { select: tweetSelect } },
    orderBy: [{ tweet: { createdAt: "desc" } }, { tweet: { id: "desc" } }],
    take: limit + 1,
  });

  const hasMore = tweetHashes.length > limit;
  const rawTweets = (hasMore ? tweetHashes.slice(0, limit) : tweetHashes).map(
    (r) => r.tweet
  );
  const nextCursor = utils.buildNextCursor(rawTweets, hasMore, encoderService);

  const data = checkUserInteractions(rawTweets);
  return { tweets: data, nextCursor, hasMore };
};

// -------------------- Fetch Trends --------------------

// Helper: Validate and parse category from string
export function parseCategory(categoryParam: string): utils.TrendCategory {
  const normalized = categoryParam.toLowerCase();
  const validCategories = Object.values(utils.TrendCategory);

  const category = validCategories.find(
    (cat) => cat.toLowerCase() === normalized
  );
  if (!category) {
    throw new AppError(
      `Invalid category. Must be one of: ${validCategories.join(", ")}`,
      400
    );
  }
  return category;
}

// Helper function: read cached data
export const readCachedData = async (redisKey: string) => {
  const cached = await redisClient.get(redisKey);
  if (!cached) return null;

  try {
    return JSON.parse(cached);
  } catch (err) {
    console.error(`Error parsing cached data for key ${redisKey}:`, err);
    return null;
  }
};

// Helper function: get trends from query search
export const getTrendsFromQuery = async (
  query: string,
  limit: number,
  category: utils.TrendCategory
) => {
  const q = query.trim().toLowerCase();
  const matching = await prisma.hash.findMany({
    where: { tag_text: { startsWith: q, mode: "insensitive" } },
    select: { id: true, tag_text: true },
    take: 500,
  });
  if (!matching.length) {
    return { trends: [], updatedAt: new Date().toISOString() };
  }
  const matchingIds = matching.map((m) => m.id);
  const trends = await calculateTrends(
    category,
    { matchingIds, limit },
    24 * 30
  );
  return { trends, updatedAt: new Date().toISOString() };
};

// fetch trends
export const fetchTrends = async (
  query?: string | null,
  category: utils.TrendCategory = utils.TrendCategory.Global,
  limit: number = TRENDS_LIMIT
) => {
  if (query?.trim()) return getTrendsFromQuery(query, limit, category);

  const cached = await readCachedData(TREND_CACHE_KEY(category));
  if (cached)
    return {
      trends: cached.trends.slice(0, limit),
      updatedAt: cached.updatedAt,
    };

  await calculateAndCacheTrends(category);
  const newCached = await readCachedData(TREND_CACHE_KEY(category));
  return newCached
    ? {
        trends: newCached.trends.slice(0, limit),
        updatedAt: newCached.updatedAt,
      }
    : { trends: [], updatedAt: new Date().toISOString() };
};

// fetch viral tweets - now uses explore service
export const fetchViralTweets = async (
  userId: string,
  category: utils.TrendCategory = utils.TrendCategory.Global,
  limit: number = 5
) => {
  const exploreService = ExploreService.getInstance();

  const result = await exploreService.getFeed({
    userId,
    category: category === utils.TrendCategory.Global ? undefined : category,
    limit,
  });

  return {
    tweets: result.data,
    updatedAt: new Date().toISOString(),
  };
};

// fetch category trending data
export const fetchCategoryData = async (
  categoryParam: string | utils.TrendCategory,
  userId: string
) => {
  const category =
    typeof categoryParam === "string"
      ? parseCategory(categoryParam)
      : categoryParam;

  const [trendsData, viralData] = await Promise.all([
    fetchTrends(null, category),
    fetchViralTweets(userId, category),
  ]);
  return {
    category,
    trends: trendsData.trends,
    viralTweets: viralData.tweets,
    updatedAt: trendsData.updatedAt,
  };
};

// fetch all categories trending data
export const fetchAllCategoriesData = async (userId: string) => {
  const categories = Object.values(utils.TrendCategory);

  const [categoriesData, whoToFollow] = await Promise.all([
    Promise.all(
      categories.map((category) => fetchCategoryData(category, userId))
    ),
    fetchWhoToFollow(userId, 5),
  ]);

  return {
    categories: categoriesData,
    whoToFollow,
  };
};

// -------------------- Worker Function --------------------
export async function TrendingHashtagsAndTweets() {
  for (const category of Object.values(utils.TrendCategory)) {
    await calculateAndCacheTrends(category);
  }
}
