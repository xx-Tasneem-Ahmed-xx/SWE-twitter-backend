// hashtagservice.ts
import { extractHashtags } from "twitter-text";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { redisClient } from "@/config/redis";
import { encoderService } from "@/application/services/encoder";
import tweetService from "@/application/services/tweets";
import * as utils from "@/application/utils/hashtag.utils";

// Trends configuration constants
const TRENDS_CACHE_TTL = 60 * 2;
const TRENDS_LIMIT = 30;
const TREND_PERIOD_HOURS = 24;
const TREND_CACHE_KEY = (category: utils.TrendCategory) =>
  `trends:category:${category.toLowerCase()}`;
const VIRAL_TWEETS_CACHE_KEY = (category: utils.TrendCategory) =>
  `trends:viral:category:${category.toLowerCase()}`;

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
  periodHours: number = TREND_PERIOD_HOURS,
  category: utils.TrendCategory,
  options?: {
    matchingIds?: string[];
    limit?: number;
  }
): Promise<utils.TrendData[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - periodHours);
  const whereClause: any = {
    tweet: {
      createdAt: { gte: cutoffDate },
      ...(category !== utils.TrendCategory.Global ? { category } : {}),
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
  return utils.mapToTrendData(limited, encoderService, prisma);
}

// Cache trends
export async function cacheTrends(
  trends: utils.TrendData[],
  category: utils.TrendCategory
) {
  await redisClient.setEx(
    TREND_CACHE_KEY(category),
    TRENDS_CACHE_TTL,
    JSON.stringify({ trends, updatedAt: new Date().toISOString() })
  );
}

// Calculate & cache trends (for worker)
export async function calculateAndCacheTrends(
  periodHours: number = TREND_PERIOD_HOURS,
  category: utils.TrendCategory
) {
  const trends = await calculateTrends(periodHours, category);
  await cacheTrends(trends, category);
  console.log(`Calculated & cached ${trends.length} trends for ${category}`);
}

// -------------------- Viral Tweets --------------------

// Calculate viral tweets for a category
export async function calculateViralTweets(
  periodHours: number = TREND_PERIOD_HOURS,
  category: utils.TrendCategory,
  limit = 5
) {
  const tweetSelect = (tweetService as any).tweetSelectFields();

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - periodHours);

  const whereClause: any = {
    createdAt: { gte: cutoffDate },
    ...(category !== utils.TrendCategory.Global ? { category } : {}),
  };

  const tweets = await prisma.tweet.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    select: tweetSelect,
  });

  const sorted = utils.sortByViral(tweets).slice(0, limit);

  return { tweets: sorted };
}

// cache viral tweets for a category
export async function cacheViralTweets(
  category: utils.TrendCategory,
  tweets: any[]
) {
  await redisClient.setEx(
    VIRAL_TWEETS_CACHE_KEY(category),
    TRENDS_CACHE_TTL,
    JSON.stringify({
      tweets,
      updatedAt: new Date().toISOString(),
    })
  );
}

// -------------------- fetch and worker --------------------

// Fetch tweets for a hashtag
export const fetchHashtagTweets = async (
  hashtagId: string,
  cursor?: { id: string; createdAt: string } | null,
  limit: number = 30,
  userId?: string | null
) => {
  const hash = await prisma.hash.findUnique({ where: { id: hashtagId } });
  if (!hash) throw new AppError("Hashtag not found", 404);

  const cursorCondition = utils.buildCursorCondition(cursor);
  const tweetSelect = (tweetService as any).tweetSelectFields(userId ?? "");

  const tweetHashes = await prisma.tweetHash.findMany({
    where: { hashId: hash.id, tweet: cursorCondition },
    include: { tweet: { select: tweetSelect } },
    orderBy: [{ tweet: { createdAt: "desc" } }, { tweet: { id: "desc" } }],
    take: limit + 1,
  });

  const hasMore = tweetHashes.length > limit;
  const rawTweets = (hasMore ? tweetHashes.slice(0, limit) : tweetHashes).map(
    (r) => r.tweet
  );
  const nextCursor = utils.buildNextCursor(rawTweets, hasMore, encoderService);

  const data = (tweetService as any).checkUserInteractions(rawTweets);
  const sorted = utils.sortByViral(data);

  return { tweets: sorted, nextCursor, hasMore };
};

// -------------------- Fetch Trends --------------------
export const fetchTrends = async (
  limit: number = TRENDS_LIMIT,
  category: utils.TrendCategory = utils.TrendCategory.Global,
  query?: string | null
) => {
  if (query?.trim()) {
    const q = query.trim().toLowerCase();
    const matching = await prisma.hash.findMany({
      where: { tag_text: { startsWith: q, mode: "insensitive" } },
      select: { id: true, tag_text: true },
      take: 500,
    });
    if (!matching.length)
      return { trends: [], updatedAt: new Date().toISOString() };

    const matchingIds = matching.map((m) => m.id);
    const trends = await calculateTrends(TREND_PERIOD_HOURS, category, {
      matchingIds,
      limit,
    });
    return { trends, updatedAt: new Date().toISOString() };
  }

  const cached = await redisClient.get(TREND_CACHE_KEY(category));
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return { trends: data.trends.slice(0, limit), updatedAt: data.updatedAt };
    } catch (err) {
      console.error("Error parsing cached trends:", err);
    }
  }

  await calculateAndCacheTrends(TREND_PERIOD_HOURS, category);
  const newCached = await redisClient.get(TREND_CACHE_KEY(category));
  if (newCached) {
    const data = JSON.parse(newCached);
    return { trends: data.trends.slice(0, limit), updatedAt: data.updatedAt };
  }

  return { trends: [], updatedAt: new Date().toISOString() };
};

// -------------------- Worker Function --------------------
export async function TrendingHashtagsAndTweets() {
  for (const category of Object.values(utils.TrendCategory)) {
    await calculateAndCacheTrends(TREND_PERIOD_HOURS, category);
    await calculateViralTweets(TREND_PERIOD_HOURS, category);
  }
}
