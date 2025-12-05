import { extractHashtags } from "twitter-text";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { redisClient } from "@/config/redis";
import { encoderService } from "@/application/services/encoder";
import tweetService from "@/application/services/tweets";

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
  likesCount: number;
  score: number;
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

// Calculate trends for a given period.
export async function calculateTrends(
  periodHours: number = TREND_PERIOD_HOURS,
  options?: { matchingIds?: string[]; limit?: number }
): Promise<TrendData[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - periodHours);

  const whereClause: any = {
    tweet: { createdAt: { gte: cutoffDate } },
  };

  if (options?.matchingIds && options.matchingIds.length > 0) {
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

  if (entries.length === 0) return [];

  const maxTweet = Math.max(...entries.map((e) => e.tweetCount));
  const maxLikes = Math.max(...entries.map((e) => e.likesSum));

  const tweetWeight = 0.63;
  const likesWeight = 0.37;

  entries.forEach((e) => {
    const tweetNorm = maxTweet > 0 ? e.tweetCount / maxTweet : 0;
    const likesNorm = maxLikes > 0 ? e.likesSum / maxLikes : 0;
    (e as any).score = tweetNorm * tweetWeight + likesNorm * likesWeight;
  });

  entries.sort((a, b) => (b as any).score - (a as any).score);

  const take = options?.limit ?? TRENDS_LIMIT;
  const top = entries.slice(0, take);

  const hashIds = top.map((t) => t.hashId);
  const hashes = await prisma.hash.findMany({
    where: { id: { in: hashIds } },
    select: { id: true, tag_text: true },
  });
  const hashMap = new Map(hashes.map((h) => [h.id, h.tag_text]));

  const trends: TrendData[] = top
    .map((item, index) => {
      const hashtag = hashMap.get(item.hashId) || "";
      if (!hashtag) return null;

      return {
        id: encoderService.encode(item.hashId),
        hashtag,
        tweetCount: item.tweetCount,
        likesCount: item.likesSum,
        score: Number(((item as any).score ?? 0).toFixed(4)),
        rank: index + 1,
      };
    })
    .filter((t): t is TrendData => t !== null);

  return trends;
}

// Cache a list of trends and set updatedAt timestamp
export async function cacheTrends(trends: TrendData[]) {
  const cacheData = { trends, updatedAt: new Date().toISOString() };
  await redisClient.setEx(
    TRENDS_CACHE_KEY,
    TRENDS_CACHE_TTL,
    JSON.stringify(cacheData)
  );
}

// Backwards-compatible function used by the worker: calculate and cache trends
export async function calculateAndCacheTrends(
  periodHours: number = TREND_PERIOD_HOURS
): Promise<void> {
  const trends = await calculateTrends(periodHours);
  await cacheTrends(trends);
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
    const matchingIds = matching.map((m) => m.id);
    const trends = await calculateTrends(TREND_PERIOD_HOURS, {
      matchingIds,
      limit,
    });
    return {
      trends: trends,
      updatedAt: new Date().toISOString(),
    };
  }

  // No query: use existing cache-first behavior for global trends
  const cached = await redisClient.get(TRENDS_CACHE_KEY);
  if (cached) {
    try {
      const data = JSON.parse(cached as any);
      return {
        trends: data.trends.slice(0, limit),
        updatedAt: data.updatedAt,
      };
    } catch (err) {
      console.error("Error parsing cached trends (v2):", err);
    }
  }

  // No versioned cache: calculate and cache (cacheTrends will also overwrite legacy key)
  await calculateAndCacheTrends(TREND_PERIOD_HOURS);
  const newCached = await redisClient.get(TRENDS_CACHE_KEY);
  if (newCached) {
    const data = JSON.parse(newCached as any);
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
  cursor?: { id: string; createdAt: string } | null,
  limit: number = 30,
  userId?: string | null
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
    const cursorDate = new Date(cursor.createdAt);
    where.tweet = {
      OR: [
        { createdAt: { lt: cursorDate } },
        { AND: [{ createdAt: cursorDate }, { id: { lt: cursor.id } }] },
      ],
    };
  }

  // select the same fields used by the tweet service's `getTweet` response
  const tweetSelect = (tweetService as any).tweetSelectFields(userId ?? "");

  const tweetHashes = await prisma.tweetHash.findMany({
    where,
    include: {
      tweet: {
        select: tweetSelect,
      },
    },
    orderBy: [{ tweet: { createdAt: "desc" } }, { tweet: { id: "desc" } }],
    take: limit + 1,
  });

  const hasMore = tweetHashes.length > limit;
  const rows = hasMore ? tweetHashes.slice(0, limit) : tweetHashes;
  const rawTweets = rows.map((r) => r.tweet);

  // reuse tweet service's interaction checker to compute isLiked/isRetweeted/isBookmarked
  const data = (tweetService as any).checkUserInteractions(rawTweets);

  const nextCursor = hasMore
    ? (() => {
        const lastTweet: any = rawTweets[rawTweets.length - 1];
        return encoderService.encode({
          id: lastTweet.id,
          createdAt:
            lastTweet && lastTweet.createdAt
              ? (lastTweet.createdAt as Date).toISOString()
              : new Date().toISOString(),
        });
      })()
    : null;

  return {
    tweets: data,
    nextCursor,
    hasMore,
  };
};
