import { extractHashtags } from "twitter-text";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { redisClient } from "@/config/redis";
import { encoderService } from "@/application/services/encoder";

// Trends configuration constants
const TRENDS_CACHE_KEY = "trends:global";
const TRENDS_CACHE_TTL = 60 * 30; // 30 minutes in seconds
const TRENDS_LIMIT = 30; // Top 30 trends
const TREND_PERIOD_HOURS = 24; // Last 24 hours

// Trend data structure
export type TrendData = {
  id: string; // Encoded hashtag ID
  hashtag: string;
  tweetCount: number;
  rank: number;
};

// Extracts and normalizes hashtags from the given text.
export function extractAndNormalizeHashtags(text?: string | null): string[] {
  if (!text) return [];

  const rawTags = extractHashtags(text) || [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of rawTags) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase();
    if (tag.length === 0) continue;
    if (tag.length > 100) continue;
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
}

// Helper: find existing hashes for a set of tags
export async function findExistingHashes(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags || tags.length === 0)
    return [] as { id: string; tag_text: string }[];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Helper: create missing hashes in batch (skipDuplicates to tolerate races)
export async function createMissingHashes(
  tx: Prisma.TransactionClient,
  missingTags: string[]
) {
  if (!missingTags || missingTags.length === 0) return;
  await tx.hash.createMany({
    data: missingTags.map((tag) => ({ tag_text: tag })),
    skipDuplicates: true,
  });
}

// Helper: get all hashes (id + tag_text) for a set of tags
export async function getAllHashesByTags(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags || tags.length === 0)
    return [] as { id: string; tag_text: string }[];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Helper: create tweet-hash relations in batch
export async function createTweetHashRelations(
  tx: Prisma.TransactionClient,
  tweetId: string,
  hashRows: { id: string; tag_text: string }[]
) {
  if (!hashRows || hashRows.length === 0) return;
  const tweetHashRows = hashRows.map((h) => ({ tweetId, hashId: h.id }));
  await tx.tweetHash.createMany({ data: tweetHashRows, skipDuplicates: true });
}

// Attach hashtags found in the text to the given tweet
export async function attachHashtagsToTweet(
  tweetId: string,
  text: string | null | undefined,
  tx: Prisma.TransactionClient
) {
  if (!tweetId) throw new AppError("Server Error: tweetId is required", 500);
  if (!tx)
    throw new AppError("Server Error: transaction client is required", 500);

  const tags = extractAndNormalizeHashtags(text);
  if (!tags || tags.length === 0) return;

  const existing = await findExistingHashes(tx, tags);
  const existingSet = new Set(existing.map((h) => h.tag_text));

  const missing = tags.filter((t) => !existingSet.has(t));
  await createMissingHashes(tx, missing);

  const allHashes = await getAllHashesByTags(tx, tags);
  await createTweetHashRelations(tx, tweetId, allHashes);
}

// Calculate trends based on hashtag usage in tweets over the specified period
export async function calculateAndCacheTrends(
  periodHours: number = TREND_PERIOD_HOURS
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - periodHours);

  const hashtagCounts = await prisma.tweetHash.groupBy({
    by: ["hashId"],
    _count: {
      hashId: true,
    },
    where: {
      tweet: {
        createdAt: {
          gte: cutoffDate,
        },
      },
    },
    orderBy: {
      _count: {
        hashId: "desc",
      },
    },
    take: TRENDS_LIMIT,
  });

  const hashIds = hashtagCounts.map((item) => item.hashId);
  const hashes = await prisma.hash.findMany({
    where: {
      id: {
        in: hashIds,
      },
    },
    select: {
      id: true,
      tag_text: true,
    },
  });

  const hashMap = new Map(hashes.map((h) => [h.id, h.tag_text]));

  const trends: TrendData[] = hashtagCounts
    .map((item, index) => {
      const hashtag = hashMap.get(item.hashId) || "";
      if (!hashtag) return null;

      return {
        id: encoderService.encode(item.hashId),
        hashtag,
        tweetCount: item._count.hashId,
        rank: index + 1,
      };
    })
    .filter((trend): trend is TrendData => trend !== null);

  const cacheData = {
    trends,
    updatedAt: new Date().toISOString(),
  };

  await redisClient.setEx(
    TRENDS_CACHE_KEY,
    TRENDS_CACHE_TTL,
    JSON.stringify(cacheData)
  );

  console.log(`Calculated and cached ${trends.length} trends`);
}

// Fetch trends from cache

export const fetchTrends = async (
  limit: number = TRENDS_LIMIT,
  query?: string | null
) => {
  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();

    const matching = await prisma.hash.findMany({
      where: { tag_text: { startsWith: q, mode: "insensitive" } },
      select: { id: true, tag_text: true },
      take: 500,
    });

    if (!matching || matching.length === 0) {
      return { trends: [], updatedAt: new Date().toISOString() };
    }

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - TREND_PERIOD_HOURS);
    const matchingIds = matching.map((m) => m.id);

    const counts = await prisma.tweetHash.groupBy({
      by: ["hashId"],
      _count: { hashId: true },
      where: {
        hashId: { in: matchingIds },
        tweet: { createdAt: { gte: cutoffDate } },
      },
    });

    const countMap = new Map(counts.map((c) => [c.hashId, c._count.hashId]));

    const allTrends: TrendData[] = matching.map((m) => ({
      id: encoderService.encode(m.id),
      hashtag: m.tag_text,
      tweetCount: countMap.get(m.id) ?? 0,
      rank: 0,
    }));

    allTrends.sort((a, b) => {
      if (b.tweetCount !== a.tweetCount) return b.tweetCount - a.tweetCount;
      return a.hashtag.localeCompare(b.hashtag);
    });

    const trends = allTrends.slice(0, limit).map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));

    return { trends, updatedAt: new Date().toISOString() };
  }

  // No query: use existing cache-first behavior for global trends
  const cached = await redisClient.get(TRENDS_CACHE_KEY);

  if (cached) {
    try {
      const data = JSON.parse(cached);
      return {
        trends: data.trends.slice(0, limit),
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      console.error("Error parsing cached trends:", error);
    }
  }

  await calculateAndCacheTrends(TREND_PERIOD_HOURS);
  const newCached = await redisClient.get(TRENDS_CACHE_KEY);
  if (newCached) {
    const data = JSON.parse(newCached);
    return {
      trends: data.trends.slice(0, limit),
      updatedAt: data.updatedAt,
    };
  }

  return {
    trends: [],
    updatedAt: new Date().toISOString(),
  };
};

// Fetch tweets for a specific hashtag with pagination
export const fetchHashtagTweets = async (
  hashtagId: string,
  cursor?: string | null,
  limit: number = 30
) => {
  const hash = await prisma.hash.findUnique({
    where: {
      id: hashtagId,
    },
  });

  if (!hash) {
    throw new AppError("Hashtag not found", 404);
  }

  const where: any = {
    hashId: hash.id,
  };

  if (cursor) {
    where.tweetId = {
      lt: cursor,
    };
  }

  const tweetHashes = await prisma.tweetHash.findMany({
    where,
    include: {
      tweet: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileMedia: { select: { id: true } },
              verified: true,
              protectedAccount: true,
            },
          },
        },
      },
    },
    orderBy: {
      tweet: {
        createdAt: "desc",
      },
    },
    take: limit + 1,
  });

  const hasMore = tweetHashes.length > limit;
  const tweets = hasMore ? tweetHashes.slice(0, limit) : tweetHashes;
  const nextCursor = hasMore
    ? encoderService.encode(tweets[tweets.length - 1].tweetId)
    : null;

  return {
    tweets: tweets.map((th) => th.tweet),
    nextCursor,
    hasMore,
  };
};
