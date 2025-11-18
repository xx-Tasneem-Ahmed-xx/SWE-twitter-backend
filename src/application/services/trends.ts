import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { redisClient } from "@/config/redis";
import encoderService from "@/application/services/encoder";

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

  console.log(` Calculated and cached ${trends.length} trends`);
}

// Fetch trends from cache
export const fetchTrends = async (limit: number = TRENDS_LIMIT) => {
  const cached = await redisClient.get(TRENDS_CACHE_KEY);

  if (cached) {
    try {
      const data = JSON.parse(cached);
      return {
        trends: data.trends.slice(0, limit),
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      //TODO: what to throw here?
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

// Fetch tweets for a specific trend with pagination
export const fetchTrendTweets = async (
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
