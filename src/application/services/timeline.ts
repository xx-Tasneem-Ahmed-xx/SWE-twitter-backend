import { prisma } from "@/prisma/client";
import Redis from "ioredis";
import {
  TimelineServiceDTO,
  ForYouServiceDTO,
} from "@/application/dtos/timeline/timeline.dto";

/**
 * Simple Redis client. Configure via REDIS_URL env var.
 * For small deployments change settings accordingly. In production prefer a managed redis.
 */
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

type ScoredTweet = {
  id: string;
  createdAt: Date | string;
  userId: string;
  content: string;
  score: number;
  _meta?: any;
};

export class TimelineService {
  constructor(private cache = redis) {}

  /**************************************************************************
   * Simple Get timeline — tweets from followings + self (existing behavior)
   **************************************************************************/
  async getTimeline(dto: TimelineServiceDTO) {
    const followers = await prisma.follow.findMany({
      where: { followerId: dto.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });

    const followingIds = followers.map((f) => f.followingId);

    const muted = await prisma.mute.findMany({
      where: { muterId: dto.userId },
      select: { mutedId: true },
    });
    const mutedIds = muted.map((m) => m.mutedId);

    const tweets = await prisma.tweet.findMany({
      where: {
        AND: [
          { userId: { in: [...followingIds, dto.userId] } },
          { userId: { notIn: mutedIds } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileMedia: { select: { id: true, keyName: true } },
            verified: true,
            protectedAccount: true,
          },
        },
        _count: { select: { tweetLikes: true, retweets: true } },
        tweetMedia: { select: { mediaId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: { id: dto.cursor }, skip: 1 }),
    });

    const hasNext = tweets.length > dto.limit;
    const data = hasNext ? tweets.slice(0, -1) : tweets;

    // convert dates to ISO for consistent DTOs
    return {
      data: data.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
      nextCursor: hasNext ? data[data.length - 1].id : null,
    };
  }

  /**************************************************************************
   * For You: Candidate generation + scoring + caching
   *
   * Approach:
   * 1) Gather lists (following, muted, blocked).
   * 2) Candidate sets:
   *    - inNetwork: recent tweets from followings
   *    - outNetwork: popular/relevant tweets (hashtags liked by user's network, popular recent tweets)
   * 3) Score tweets with a heuristic combining engagement, relevance, author score, freshness.
   * 4) Sort, slice, return. Cache results for short TTL.
   **************************************************************************/
  async getForYou(dto: ForYouServiceDTO) {
    const cacheKey = `foryou:${dto.userId}:l${dto.limit}:c:${
      dto.cursor ?? "null"
    }`;

    // try cache (short TTL). Store a small page of results.
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // continue if parse fails
      }
    }

    // 1) lists
    const followingRows = await prisma.follow.findMany({
      where: { followerId: dto.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });
    const followingIds = followingRows.map((r) => r.followingId);

    const mutedRows = await prisma.mute.findMany({
      where: { muterId: dto.userId },
      select: { mutedId: true },
    });
    const mutedIds = new Set(mutedRows.map((r) => r.mutedId));

    const blockedRows = await prisma.block.findMany({
      where: { blockerId: dto.userId },
      select: { blockedId: true },
    });
    const blockedIds = new Set(blockedRows.map((r) => r.blockedId));

    // 2) Candidate generation - use Prisma queries (parallel)
    // a) in-network candidates (recent)
    const inNetworkPromise = prisma.tweet.findMany({
      where: {
        AND: [
          { userId: { in: followingIds } },
          { userId: { notIn: Array.from(mutedIds) } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            verified: true,
            profileMedia: { select: { id: true, keyName: true } },
          },
        },
        _count: {
          select: { tweetLikes: true, retweets: true, tweetBookmark: true },
        },
        tweetMedia: { select: { mediaId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // b) out-network candidates:
    //    - tweets liked by people user follows (social proof)
    //    - popular recent tweets globally (top N)
    const likedByFollowingPromise = prisma.tweet.findMany({
      where: {
        tweetLikes: { some: { userId: { in: followingIds } } },
        userId: { notIn: [...followingIds, dto.userId] },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            verified: true,
            profileMedia: { select: { id: true, keyName: true } },
          },
        },
        _count: {
          select: { tweetLikes: true, retweets: true, tweetBookmark: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const popularRecentPromise = prisma.tweet.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) },
      }, // last 3 days
      include: {
        user: {
          select: {
            id: true,
            username: true,
            verified: true,
            profileMedia: { select: { id: true, keyName: true } },
          },
        },
        _count: {
          select: { tweetLikes: true, retweets: true, tweetBookmark: true },
        },
      },
      orderBy: { likesCount: "desc" }, // heuristic
      take: 500,
    });

    const [inNetwork, likedByFollowing, popularRecent] = await Promise.all([
      inNetworkPromise,
      likedByFollowingPromise,
      popularRecentPromise,
    ]);

    // merge candidates and dedupe
    const poolMap = new Map<string, any>();
    const pushCandidate = (t: any) => {
      if (!t || !t.id) return;
      if (mutedIds.has(t.userId) || blockedIds.has(t.userId)) return;
      if (!poolMap.has(t.id)) poolMap.set(t.id, t);
    };

    inNetwork.forEach(pushCandidate);
    likedByFollowing.forEach(pushCandidate);
    popularRecent.forEach(pushCandidate);

    const pool = Array.from(poolMap.values());

    // scoring function (heuristic)
    const now = Date.now();
    const userInteractions = await this._getUserInteractionSignals(dto.userId);

    const scored: ScoredTweet[] = pool.map((t) => {
      const likes = (t._count?.tweetLikes ?? 0) + (t.likesCount ?? 0);
      const retweets = (t._count?.retweets ?? 0) + (t.retweetCount ?? 0);
      const bookmarks = (t._count?.tweetBookmark ?? 0) || 0;
      const replies = t.repliesCount ?? 0;

      // engagement score
      const engagement =
        likes * 1.2 + retweets * 1.5 + replies * 0.8 + bookmarks * 3;

      // author score
      const authorBoost = (t.user?.verified ? 8 : 0) + 0; // you can add followers count if tracked

      // relevance
      let relevance = 0;
      if (userInteractions.interactedAuthors.has(t.userId)) relevance += 4;
      if (userInteractions.topHashtags.some((h) => t.content?.includes(h)))
        relevance += 2;

      // freshness penalty
      const createdAtMs = new Date(t.createdAt).getTime();
      const hoursOld = Math.max((now - createdAtMs) / (1000 * 60 * 60), 0);
      const freshnessPenalty = hoursOld * 0.35;

      const score =
        engagement * 0.7 +
        relevance * 1.6 +
        authorBoost * 1.2 -
        freshnessPenalty;

      return {
        id: t.id,
        createdAt: t.createdAt,
        userId: t.userId,
        content: t.content,
        score,
        _meta: {
          tweet: t,
        },
      };
    });

    // sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // pagination using cursor = tweet.id (we used in-memory sorted list)
    let startIndex = 0;
    if (dto.cursor) {
      const idx = scored.findIndex((s) => s.id === dto.cursor);
      if (idx >= 0) startIndex = idx + 1;
    }

    const page = scored.slice(startIndex, startIndex + dto.limit);
    const nextCursor =
      startIndex + dto.limit < scored.length
        ? scored[startIndex + dto.limit].id
        : null;

    // build response (map back to smaller objects)
    const response = {
      user: dto.userId,
      recommendations: page.map((s) => {
        const t = s._meta.tweet;
        return {
          id: t.id,
          createdAt:
            t.createdAt instanceof Date
              ? t.createdAt.toISOString()
              : t.createdAt,
          content: t.content,
          author: t.user
            ? {
                id: t.user.id,
                username: t.user.username,
                name: t.user.name,
                verified: t.user.verified,
                profileMedia: t.user.profileMedia,
              }
            : null,
          score: s.score,
          counts: {
            likes: t._count?.tweetLikes ?? t.likesCount ?? 0,
            retweets: t._count?.retweets ?? t.retweetCount ?? 0,
            bookmarks: t._count?.tweetBookmark ?? 0,
          },
        };
      }),
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // cache short TTL
    await this.cache.set(cacheKey, JSON.stringify(response), "EX", 12); // 12 seconds TTL

    return response;
  }

  /**
   * Gather light-weight interaction signals for the user
   * (authors interacted with, top hashtags)
   */
  private async _getUserInteractionSignals(userId: string) {
    // users that this user interacted with (liked/retweet/replied)
    const likedAuthors = await prisma.tweetLike.findMany({
      where: { userId },
      select: { tweet: { select: { userId: true } } },
      take: 200,
    });
    const retweetedAuthors = await prisma.retweet.findMany({
      where: { userId },
      select: { tweet: { select: { userId: true } } },
      take: 200,
    });

    const interactedAuthorsSet = new Set<string>();
    likedAuthors.forEach(
      (l) => l.tweet && interactedAuthorsSet.add(l.tweet.userId)
    );
    retweetedAuthors.forEach(
      (r) => r.tweet && interactedAuthorsSet.add(r.tweet.userId)
    );

    // top hashtags used by this user (from their tweets)
    const userTweets = await prisma.tweet.findMany({
      where: { userId },
      select: { content: true },
      take: 200,
    });

    // simple hashtag extraction
    const hashtagCounts = new Map<string, number>();
    for (const t of userTweets) {
      const matches = t.content?.match(/#\w+/g) ?? [];
      for (const m of matches) {
        const h = m.toLowerCase();
        hashtagCounts.set(h, (hashtagCounts.get(h) ?? 0) + 1);
      }
    }

    const topHashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map((x) => x[0].replace("#", ""));

    return {
      interactedAuthors: interactedAuthorsSet,
      topHashtags,
    };
  }

  /**************************************************************************
   * Optional: raw SQL candidate query (optimized) — for large-scale systems
   * This query is an advanced candidate generation SQL that picks:
   *  - in-following recent tweets
   *  - tweets liked by followings (social proof)
   *  - popular tweets in last N days
   *
   * Keep for reference and for higher performance when you use prisma.$queryRaw
   **************************************************************************/
  async popularCandidatesRaw(userId: string, limit = 1000) {
    const sql = `
      WITH followings AS (
        SELECT followingId FROM "Follow" WHERE "followerId" = $1 AND status='ACCEPTED'
      ), mute AS (
        SELECT mutedId FROM "Mute" WHERE "muterId" = $1
      ), blocked AS (
        SELECT blockedId FROM "Block" WHERE "blockerId" = $1
      )
      SELECT t.*,
        u.username AS author_username,
        u.name AS author_name,
        u.verified as author_verified,
        COALESCE(l.likes,0) AS likes,
        COALESCE(r.retweets,0) AS retweets
      FROM "tweets" t
      JOIN "users" u ON u.id = t."userId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS likes FROM "TweetLike" tl WHERE tl."tweetId" = t.id
      ) l ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS retweets FROM "Retweet" rt WHERE rt."tweetId" = t.id
      ) r ON true
      WHERE t."createdAt" > NOW() - INTERVAL '7 days'
        AND t."userId" NOT IN (SELECT mutedId FROM mute)
        AND t."userId" NOT IN (SELECT blockedId FROM blocked)
      ORDER BY (COALESCE(l.likes,0) * 1.2 + COALESCE(r.retweets,0) * 1.5) DESC
      LIMIT $2;
    `;

    const rows = await prisma.$queryRawUnsafe(sql, userId, limit);
    return rows;
  }
}
