// // src/application/services/timeline.ts
// import { prisma } from "@/prisma/client";
// import { Prisma } from "@prisma/client";
// import { z } from "zod";

// // Local DTO definitions (fallback if shared DTO file is missing)
// type CursorDTO = { cursor?: string | null };

// // src/infra/redis/cache.ts
// import Redis from "ioredis";

// const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
// export const redis = new Redis(redisUrl);

// // util: JSON get/set helpers
// export async function cacheGet<T>(key: string): Promise<T | null> {
//   const v = await redis.get(key);
//   return v ? (JSON.parse(v) as T) : null;
// }
// export async function cacheSet(key: string, value: any, ttlSeconds = 60) {
//   await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
// }

// interface TimelineItemDTO {
//   id: string;
//   content: string | null;
//   userId: string;
//   username: string;
//   name: string | null;
//   profileMediaKey: string | null;
//   createdAt: string;
//   likesCount: number;
//   retweetCount: number;
//   repliesCount: number;
//   score: number;
//   reasons: string[];
// }

// interface ForYouResponseDTO {
//   user: string;
//   recommendations: TimelineItemDTO[];
//   nextCursor: string | null;
//   generatedAt: string;
// }

// /**
//  * Configurable weights — tune as needed
//  */
// const WEIGHTS = {
//   like: 1.0,
//   retweet: 2.0,
//   reply: 0.5,
//   recencyHalfLifeHours: 24, // recency decay
//   followBoost: 2.0, // tweets from direct followings boost
//   followingLikedBoost: 1.6, // tweets liked/retweeted by followings
//   topicMatchBoost: 1.7,
//   verifiedBoost: 1.1,
// };

// function recencyScore(createdAt: Date) {
//   // exponential decay: score = 2^(-age / halfLife)
//   const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
//   const half = WEIGHTS.recencyHalfLifeHours;
//   return Math.pow(2, -ageHours / half);
// }

// function baseEngagementScore(tweet: {
//   likesCount: number;
//   retweetCount: number;
//   repliesCount?: number;
// }) {
//   const { likesCount, retweetCount, repliesCount = 0 } = tweet;
//   return (
//     likesCount * WEIGHTS.like +
//     retweetCount * WEIGHTS.retweet +
//     repliesCount * WEIGHTS.reply
//   );
// }

// /**
//  * helper to map DB tweet rows -> TimelineItemDTO
//  */
// function mapTweetRowToDTO(row: any): TimelineItemDTO {
//   return {
//     id: row.id,
//     content: row.content,
//     userId: row.userId,
//     username: row.username,
//     name: row.name ?? null,
//     // Use keyName from the related Media table, which is accessed via profileMedia relation on User
//     profileMediaKey: row.profileMediaKey ?? row.profileMedia?.keyName ?? null,
//     createdAt: row.createdAt.toISOString(),
//     likesCount: Number(row.likesCount ?? 0),
//     retweetCount: Number(row.retweetCount ?? 0),
//     repliesCount: Number(row.repliesCount ?? 0),
//     score: Number(row._score ?? 0),
//     reasons: row._reasons ?? [],
//   };
// }

// export class TimelineService {
//   /**
//    * Returns timeline (followings + own posts) - basic timeline
//    */
  // async getTimeline(params: {
  //   userId: string;
  //   limit?: number;
  //   cursor?: string;
  // }) {
  //   const limit = params.limit ?? 20;

  //   // Get followings
  //   const followRows = await prisma.follow.findMany({
  //     where: { followerId: params.userId, status: "ACCEPTED" },
  //     select: { followingId: true },
  //   });
  //   const followingIds = followRows.map((r) => r.followingId);

  //   // Get muted users
  //   const mutedRows = await prisma.mute.findMany({
  //     where: { muterId: params.userId },
  //     select: { mutedId: true },
  //   });
  //   const mutedIds = mutedRows.map((r) => r.mutedId);

  //   // Build where clause: tweets by followings OR the user (exclude muted)
  //   const whereClause = {
  //     AND: [
  //       { userId: { in: [...followingIds, params.userId] } },
  //       { userId: { notIn: mutedIds } },
  //     ],
  //   };

  //   // Cursor support: cursor is tweet.id; but better is createdAt+id; for simplicity use id with skip
  //   const tweets = await prisma.tweet.findMany({
  //     where: whereClause,
  //     include: {
  //       user: {
  //         select: {
  //           username: true,
  //           name: true,
  //           profileMedia: { select: { keyName: true } },
  //           verified: true,
  //         },
  //       },
  //     },
  //     orderBy: { createdAt: "desc" },
  //     take: limit + 1,
  //     ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
  //   });

  //   const hasNextPage = tweets.length > limit;
  //   const page = hasNextPage ? tweets.slice(0, -1) : tweets;

  //   const mapped = page.map((t) =>
  //     mapTweetRowToDTO({
  //       id: t.id,
  //       content: t.content,
  //       userId: t.userId,
  //       username: t.user.username,
  //       name: t.user.name,
  //       profileMediaKey: t.user.profileMedia?.keyName ?? null,
  //       createdAt: t.createdAt,
  //       likesCount: t.likesCount,
  //       retweetCount: t.retweetCount,
  //       repliesCount: t.repliesCount,
  //     })
  //   );

  //   return {
  //     data: mapped,
  //     nextCursor: hasNextPage ? page[page.length - 1].id : null,
  //   };
  // }

//   /**
//    * For You — personalized feed
//    *
//    * Steps:
//    * 1. Check cache key `for-you:${userId}:${limit}:${cursor}`
//    * 2. Candidate generation:
//    * - recent tweets from followings and 2-hop followings
//    * - tweets liked/retweeted by followings
//    * - trending (global high-engagement tweets in last 48h)
//    * - tweets matching user's top hashtags/topics (derived from their likes/posts)
//    * 3. Score & rank candidates
//    * 4. Return top N paginated
//    *
//    * The algorithm is simplified but follows key X signals.
//    */
//   async getForYou(params: {
//     userId: string;
//     limit?: number;
//     cursor?: string;
//   }): Promise<ForYouResponseDTO> {
//     const limit = params.limit ?? 20;
//     const cacheKey = `for-you:${params.userId}:l${limit}:c${
//       params.cursor ?? "none"
//     }`;
//     // Try redis cache first
//     const cached = await cacheGet<ForYouResponseDTO>(cacheKey);
//     if (cached) return cached;

//     // 1) get direct followings
//     const followRows = await prisma.follow.findMany({
//       where: { followerId: params.userId, status: "ACCEPTED" },
//       select: { followingId: true },
//     });
//     const followingIds = followRows.map((r) => r.followingId);

//     // 2) 2-hop followings (people followed by your followings) up to 100
//     // NOTE: 'Follow' is the model name, used in the raw query (this should be fine, but sometimes needs 'follows')
//     const twoHopRows = await prisma.$queryRaw<
//       { followingId: string }[]
//     >`SELECT DISTINCT f2."followingId" FROM "Follow" f1 JOIN "Follow" f2 ON f1."followingId" = f2."followerId" WHERE f1."followerId" = ${params.userId} LIMIT 100`;
//     const twoHopIds = twoHopRows
//       .map((r) => r.followingId)
//       .filter((id) => id !== params.userId && !followingIds.includes(id));

//     // 3) muted and blocked filter
//     const mutedRows = await prisma.mute.findMany({
//       where: { muterId: params.userId },
//       select: { mutedId: true },
//     });
//     const mutedIds = mutedRows.map((r) => r.mutedId);

//     // 4) derive user's top hashtags from their liked tweets / own tweets
//     // REPLACEMENT: "TweetHash" -> "tweetHashes", "Tweet" -> "tweets", "Hash" -> "hashes"
//     const userTopHashtags = await prisma.$queryRaw<
//       { tag_text: string; cnt: string }[]
//     >`
//       SELECT h.tag_text, COUNT(*) as cnt
//       FROM "tweetHashes" th
//       JOIN "tweets" t ON t.id = th."tweetId"
//       JOIN "hashes" h ON h.id = th."hashId"
//       WHERE t."userId" = ${params.userId}
//       OR t.id IN (
//         SELECT "tweetId" FROM "TweetLike" WHERE "userId" = ${params.userId}
//       )
//       GROUP BY h.tag_text ORDER BY cnt DESC LIMIT 10
//     `;
//     const userHashtags = userTopHashtags.map((r) => r.tag_text);

//     // 5) Candidate generation query (raw SQL for speed)
//     // REPLACEMENT: "Tweet" -> "tweets", "User" -> "users", "Media" -> "medias", "TweetHash" -> "tweetHashes", "Hash" -> "hashes"
//     const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//     const candidates = await prisma.$queryRaw<any[]>`
//       WITH base AS (
//         SELECT t.*,
//           u.username,
//           u.name,
//           u."profileMediaId",
//           u.verified,
//           m."keyName" as "profileMediaKey",
//           COALESCE(t."likesCount",0) as likes,
//           COALESCE(t."retweetCount",0) as rts,
//           COALESCE(t."repliesCount",0) as replies,
//           (
//             SELECT ARRAY_AGG(h."tag_text")
//             FROM "tweetHashes" th
//             JOIN "hashes" h ON th."hashId" = h.id
//             WHERE th."tweetId" = t.id
//           ) AS tags
//         FROM "tweets" t
//         JOIN "users" u ON u.id = t."userId"
//         LEFT JOIN "medias" m ON m.id = u."profileMediaId"
//         WHERE t."createdAt" >= ${sevenDaysAgo}
//           AND t."userId" NOT IN (${Prisma.join(
//             mutedIds.length
//               ? mutedIds.map((id) => Prisma.sql`${id}`)
//               : [Prisma.sql`'__null_placeholder__'`],
//             ","
//           )})
//           AND t."userId" != ${params.userId} -- Exclude own tweets initially
//       ),
//       -- candidates from followings
//       from_followings AS (
//         SELECT *, 'from_following' as reason FROM base WHERE "userId" IN (${Prisma.join(
//           followingIds.length
//             ? followingIds.map((id) => Prisma.sql`${id}`)
//             : [Prisma.sql`'__null_placeholder__'`],
//           ","
//         )})
//       ),
//       from_2hop AS (
//         SELECT *, 'from_2hop' as reason FROM base WHERE "userId" IN (${Prisma.join(
//           twoHopIds.length
//             ? twoHopIds.map((id) => Prisma.sql`${id}`)
//             : [Prisma.sql`'__null_placeholder__'`],
//           ","
//         )})
//       ),
//       liked_by_followings AS (
//         SELECT b.*, 'liked_by_following' as reason
//         FROM base b
//         JOIN "TweetLike" tl on tl."tweetId" = b.id
//         WHERE tl."userId" IN (${Prisma.join(
//           followingIds.length
//             ? followingIds.map((id) => Prisma.sql`${id}`)
//             : [Prisma.sql`'__null_placeholder__'`],
//           ","
//         )})
//       ),
//       trending AS (
//         SELECT *, 'trending' as reason
//         FROM base
//         ORDER BY (likes * 1.0 + rts * 2.0) DESC
//         LIMIT 200
//       ),
//       topic_match AS (
//         SELECT b.*, 'topic' as reason FROM base b
//         WHERE b.tags && ARRAY[${Prisma.join(
//           userHashtags.length
//             ? userHashtags.map((h) => Prisma.sql`${h}`)
//             : [Prisma.sql`'__null_placeholder__'`],
//           ","
//         )}]::text[]
//       )
//       SELECT DISTINCT ON (id) *
//       FROM (
//         SELECT * FROM from_followings
//         UNION ALL
//         SELECT * FROM liked_by_followings
//         UNION ALL
//         SELECT * FROM trending
//         UNION ALL
//         SELECT * FROM from_2hop
//         UNION ALL
//         SELECT * FROM topic_match
//         UNION ALL
//         SELECT *, 'self' as reason FROM base WHERE "userId" = ${
//           params.userId
//         } -- Include own tweets in scoring/ranking pool
//       ) x
//       ORDER BY id, (likes + rts * 2) DESC -- Deduplication by ID, keeping the one with higher engagement for the case where a tweet appears in multiple sets
//       LIMIT 1000
//     `;

//     // If no candidates found, fallback to global trending
//     let finalCandidates = candidates;
//     if (!finalCandidates || finalCandidates.length === 0) {
//       const trending = await prisma.tweet.findMany({
//         where: { createdAt: { gte: sevenDaysAgo } },
//         orderBy: [{ retweetCount: "desc" }, { likesCount: "desc" }],
//         take: 200,
//         include: {
//           user: {
//             select: {
//               username: true,
//               name: true,
//               profileMedia: { select: { keyName: true } },
//               verified: true,
//             },
//           },
//         },
//       });
//       finalCandidates = trending.map((t) => ({ ...t, reason: "trending" }));
//     }

//     // 6) Score candidates
//     const scored = finalCandidates.map((r: any) => {
//       // Handle different casing/naming from raw SQL vs. Prisma findMany
//       const createdAt = new Date(r.createdAt ?? r.created_at ?? r["createdAt"]);
//       let score = baseEngagementScore({
//         likesCount: Number(r.likes ?? r.likesCount ?? 0),
//         retweetCount: Number(r.rts ?? r.retweetCount ?? 0),
//         repliesCount: Number(r.replies ?? r.repliesCount ?? 0),
//       });
//       score *= recencyScore(createdAt);

//       // boost if from direct following
//       if (followingIds.includes(r.userId)) score *= WEIGHTS.followBoost;
//       // boost if two-hop less
//       if (twoHopIds.includes(r.userId)) score *= 1.2;

//       // if liked by followings (reason property)
//       if ((r.reason ?? "").includes("liked_by_following"))
//         score *= WEIGHTS.followingLikedBoost;

//       // if tags overlap
//       // Tags might be an array or null/undefined from raw query
//       const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
//       const tagOverlap = tags.filter((t: string) =>
//         userHashtags.includes(t)
//       ).length;
//       if (tagOverlap > 0)
//         score *= Math.pow(WEIGHTS.topicMatchBoost, Math.min(3, tagOverlap));

//       // r.verified might be a boolean or a 0/1 number or undefined depending on source
//       const isVerified = r.verified === true || r.verified === 1;
//       if (isVerified) score *= WEIGHTS.verifiedBoost;

//       // small diversity penalty by author frequency (not implemented fully here)
//       // The _reasons array will contain the original reason for candidate inclusion
//       return { row: r, _score: score, _reasons: [String(r.reason)] };
//     });

//     // 7) Sort by score desc and dedupe authors to improve diversity
//     scored.sort((a, b) => b._score - a._score);

//     const seenTweetIds = new Set<string>();
//     const seenAuthors = new Map<string, number>();
//     const results: any[] = [];
//     for (const s of scored) {
//       const id = s.row.id;
//       if (seenTweetIds.has(id)) continue;

//       // diversity: penalize same author repeats
//       const authorCount = seenAuthors.get(s.row.userId) ?? 0;
//       if (authorCount > 2) continue; // skip too many from same author
//       seenAuthors.set(s.row.userId, authorCount + 1);

//       results.push({ ...s.row, _score: s._score, _reasons: s._reasons });
//       seenTweetIds.add(id);
//       if (results.length >= limit * 2) break; // fetch up to 2 * limit to improve pagination accuracy
//     }

//     // 8) Final sort and paginate by score
//     // (Already sorted, but re-sort just in case diversity logic shifted things)
//     results.sort((a, b) => b._score - a._score);

//     // Cursor support: if cursor provided skip till that id
//     let startIndex = 0;
//     if (params.cursor) {
//       const idx = results.findIndex((r) => r.id === params.cursor);
//       if (idx >= 0) startIndex = idx + 1;
//     }
//     const page = results.slice(startIndex, startIndex + limit);
//     const nextCursor =
//       startIndex + limit < results.length
//         ? results[startIndex + limit].id
//         : null;

//     // Map to DTO
//     const items = page.map((r) =>
//       mapTweetRowToDTO({
//         id: r.id,
//         content: r.content,
//         userId: r.userId,
//         username: r.username ?? r.user?.username,
//         name: r.name ?? r.user?.name,
//         profileMediaKey:
//           r.profileMediaKey ?? r.user?.profileMedia?.keyName ?? null,
//         createdAt: new Date(r.createdAt ?? r.created_at),
//         likesCount: r.likes ?? r.likesCount ?? 0,
//         retweetCount: r.rts ?? r.retweetCount ?? 0,
//         repliesCount: r.replies ?? r.repliesCount ?? 0,
//         _score: r._score,
//         _reasons: r._reasons,
//       })
//     );

//     const response: ForYouResponseDTO = {
//       user: params.userId,
//       recommendations: items,
//       nextCursor,
//       generatedAt: new Date().toISOString(),
//     };

//     // Cache for short time (10s) — fast subsequent requests
//     await cacheSet(cacheKey, response, 10);

//     return response;
//   }
// }

// =================================================================================
// src/application/services/timeline.ts
import { prisma } from "@/prisma/client";
import { Prisma } from "@prisma/client";


type ForYouParams = { userId: string; limit?: number; cursor?: string };

import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
export const redis = new Redis(redisUrl);

// util: JSON get/set helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const v = await redis.get(key);
  return v ? (JSON.parse(v) as T) : null;
}
export async function cacheSet(key: string, value: any, ttlSeconds = 60) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

interface TimelineItemDTO {
  id: string;
  content: string | null;
  userId: string;
  username: string;
  name: string | null;
  profileMediaKey: string | null;
  createdAt: string;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  score: number;
  reasons: string[];
}

interface ForYouResponseDTO {
  user: string;
  recommendations: TimelineItemDTO[];
  nextCursor: string | null;
  generatedAt: string;
}

/**
 * TUNABLE constants — adjust these to change ranking behavior.
 * Many of these mirror patterns used in production ranking.
 */
const CONFIG = {
  recencyHalfLifeHours: 18, // tighter decay -> fresher items favored
  engagementWeights: { like: 1.0, retweet: 2.2, reply: 0.8 }, // adjust curve
  followBoost: 2.6,
  twoHopBoost: 1.25,
  followingLikedBoost: 1.7,
  bookmarkByFollowingBoost: 1.5, // NEW: Boost for tweets bookmarked by followings
  topicMatchBoost: 1.9,
  verifiedBoost: 1.12,
  authorReputationCap: 2.0, // multiply score by reputation (default 1)
  diversityAuthorLimit: 2, // max tweets per author in final feed
  candidateLimit: 1500, // number of candidates to collect before ranking
  trendingWindowHours: 48,
  trendingLimit: 300,
  cacheTTL: 10, // seconds
  randomNoiseStddev: 0.02, // small noise to avoid deterministic tie ordering
};

function recencyScore(createdAt: Date) {
  // exponential half-life: 2^(-age/halfLife)
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return Math.pow(2, -ageHours / CONFIG.recencyHalfLifeHours);
}

function baseEngagementScore(tweet: {
  likes: number;
  rts: number;
  replies: number;
}) {
  return (
    tweet.likes * CONFIG.engagementWeights.like +
    tweet.rts * CONFIG.engagementWeights.retweet +
    tweet.replies * CONFIG.engagementWeights.reply
  );
}

function gaussianNoise(std = CONFIG.randomNoiseStddev) {
  // Box-Muller transform for small Gaussian noise
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std;
}

function mapRowToDTO(row: any): TimelineItemDTO {
  return {
    id: row.id,
    content: row.content,
    userId: row.userId,
    username: row.username ?? row.user?.username,
    name: row.name ?? row.user?.name ?? null,
    profileMediaKey: row.profileMediaKey ?? row.user?.profileMedia?.keyName ?? null,
    createdAt: (row.createdAt && new Date(row.createdAt).toISOString()) || new Date().toISOString(),
    likesCount: Number(row.likes ?? row.likesCount ?? 0),
    retweetCount: Number(row.rts ?? row.retweetCount ?? 0),
    repliesCount: Number(row.replies ?? row.repliesCount ?? 0),
    score: Number(row._score ?? row.score ?? 0),
    reasons: row._reasons ?? (row.reason ? [String(row.reason)] : []),
  };
}

function mapTweetRowToDTO(row: any): TimelineItemDTO {
  return {
    id: row.id,
    content: row.content,
    userId: row.userId,
    username: row.username,
    name: row.name ?? null,
    // Use keyName from the related Media table, which is accessed via profileMedia relation on User
    profileMediaKey: row.profileMediaKey ?? row.profileMedia?.keyName ?? null,
    createdAt: row.createdAt.toISOString(),
    likesCount: Number(row.likesCount ?? 0),
    retweetCount: Number(row.retweetCount ?? 0),
    repliesCount: Number(row.repliesCount ?? 0),
    score: Number(row._score ?? 0),
    reasons: row._reasons ?? [],
  };
}

export class TimelineService {
  async getTimeline(params: {
    userId: string;
    limit?: number;
    cursor?: string;
  }) {
    const limit = params.limit ?? 20;

    // Get followings
    const followRows = await prisma.follow.findMany({
      where: { followerId: params.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });
    const followingIds = followRows.map((r) => r.followingId);

    // Get muted users
    const mutedRows = await prisma.mute.findMany({
      where: { muterId: params.userId },
      select: { mutedId: true },
    });
    const mutedIds = mutedRows.map((r) => r.mutedId);

    // Build where clause: tweets by followings OR the user (exclude muted)
    const whereClause = {
      AND: [
        { userId: { in: [...followingIds, params.userId] } },
        { userId: { notIn: mutedIds } },
      ],
    };

    // Cursor support: cursor is tweet.id; but better is createdAt+id; for simplicity use id with skip
    const tweets = await prisma.tweet.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
            name: true,
            profileMedia: { select: { keyName: true } },
            verified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
    });

    const hasNextPage = tweets.length > limit;
    const page = hasNextPage ? tweets.slice(0, -1) : tweets;

    const mapped = page.map((t) =>
      mapTweetRowToDTO({
        id: t.id,
        content: t.content,
        userId: t.userId,
        username: t.user.username,
        name: t.user.name,
        profileMediaKey: t.user.profileMedia?.keyName ?? null,
        createdAt: t.createdAt,
        likesCount: t.likesCount,
        retweetCount: t.retweetCount,
        repliesCount: t.repliesCount,
      })
    );

    return {
      data: mapped,
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
    };
  }

  // Improved ForYou:
  async getForYou(params: ForYouParams): Promise<ForYouResponseDTO> {
    const limit = params.limit ?? 20;
    const cacheKey = `for-you:${params.userId}:l${limit}:c${
      params.cursor ?? "none"
    }`;

    // 1) Try cache
    const cached = await cacheGet<ForYouResponseDTO>(cacheKey);
    if (cached) return cached;

    // 2) Followings
    const followRows = await prisma.follow.findMany({
      where: { followerId: params.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });
    const followingIds = followRows.map((r) => r.followingId);

    // 3) two-hop followings (up to 200)
    const twoHopRows = await prisma.$queryRaw<{ followingId: string }[]>`
      SELECT DISTINCT f2."followingId"
      FROM "Follow" f1
      JOIN "Follow" f2 ON f1."followingId" = f2."followerId"
      WHERE f1."followerId" = ${params.userId}
      LIMIT 200
    `;
    const twoHopIds = twoHopRows
      .map((r) => r.followingId)
      .filter((id) => id !== params.userId && !followingIds.includes(id));

    // 4) Negative signals: muted, blocked, not interested, spam reports
    const mutedRows = await prisma.mute.findMany({
      where: { muterId: params.userId },
      select: { mutedId: true },
    });
    const mutedIds = mutedRows.map((r) => r.mutedId);

    const blockedRows = await prisma.block.findMany({
      where: { blockerId: params.userId },
      select: { blockedId: true },
    });
    const blockedIds = blockedRows.map((r) => r.blockedId);

    let notInterestedTweetIds: string[] = [];
    try {
      // If NotInterested model exists — cast prisma to any to avoid TS error when model is not in schema
      const ni = await (prisma as any).notInterested.findMany({
        where: { userId: params.userId },
        select: { tweetId: true },
      });
      interface NotInterestedRow {
        tweetId: string;
      }

      notInterestedTweetIds = (ni as NotInterestedRow[]).map((r) => r.tweetId);
    } catch {
      // model doesn't exist — ignore
      notInterestedTweetIds = [];
    }

    // 5) Author reputation (graceful)
    let authorReputation = new Map<string, number>();
    try {
      // Cast prisma to any and check for the model at runtime to avoid TS compile error
      const reputations = (prisma as any).authorReputation?.findMany
        ? await (prisma as any).authorReputation.findMany()
        : [];
      interface AuthorReputationRow {
        userId: string;
        score?: number | string | null;
      }

      const reputationsTyped = reputations as AuthorReputationRow[];
      reputationsTyped.forEach((r: AuthorReputationRow) =>
        authorReputation.set(r.userId, Number(r.score ?? 1.0))
      );
    } catch {
      // ignore if not present or any runtime error
    }

    // 6) Top user topics (hashtags) — same query as before (works even if empty)
    const userTopHashtags = await prisma.$queryRaw<
      { tag_text: string; cnt: string }[]
    >`
      SELECT h.tag_text, COUNT(*) as cnt
      FROM "tweetHashes" th
      JOIN "tweets" t ON t.id = th."tweetId"
      JOIN "hashes" h ON h.id = th."hashId"
      WHERE t."userId" = ${params.userId}
      OR t.id IN (SELECT "tweetId" FROM "TweetLike" WHERE "userId" = ${params.userId})
      GROUP BY h.tag_text ORDER BY cnt DESC LIMIT 10
    `;
    const userHashtags = userTopHashtags.map((r) => r.tag_text);

    // 7) Candidate generation (raw SQL) - expanded to include recent velocity for trending
    const trendingWindow = new Date(
      Date.now() - CONFIG.trendingWindowHours * 60 * 60 * 1000
    );
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build lists for SQL join; handle empty arrays with placeholder to avoid syntax errors
    const mutedPlaceholder = mutedIds.length
      ? Prisma.join(
          mutedIds.map((id) => Prisma.sql`${id}`),
          ","
        )
      : Prisma.sql`'__null__'`;
    const followingPlaceholder = followingIds.length
      ? Prisma.join(
          followingIds.map((id) => Prisma.sql`${id}`),
          ","
        )
      : Prisma.sql`'__null__'`;
    const twoHopPlaceholder = twoHopIds.length
      ? Prisma.join(
          twoHopIds.map((id) => Prisma.sql`${id}`),
          ","
        )
      : Prisma.sql`'__null__'`;
    const userHashtagPlaceholder = userHashtags.length
      ? Prisma.join(
          userHashtags.map((h) => Prisma.sql`${h}`),
          ","
        )
      : Prisma.sql`'__null__'`;

    const candidates = await prisma.$queryRaw<any[]>`
      WITH base AS (
        SELECT
          t.*,
          u.username,
          u.name,
          u."profileMediaId",
          u.verified,
          m."keyName" as "profileMediaKey",
          COALESCE(t."likesCount",0) as likes,
          COALESCE(t."retweetCount",0) as rts,
          COALESCE(t."repliesCount",0) as replies,
          (
            SELECT ARRAY_AGG(h."tag_text")
            FROM "tweetHashes" th
            JOIN "hashes" h ON th."hashId" = h.id
            WHERE th."tweetId" = t.id
          ) AS tags,
          -- simple velocity: likes+retweets within trending window
          (
            SELECT COUNT(*) FROM "TweetLike" tl WHERE tl."tweetId" = t.id AND tl."createdAt" >= ${trendingWindow}
          ) as likes_recent,
          (
            SELECT COUNT(*) FROM "Retweet" rt WHERE rt."tweetId" = t.id AND rt."createdAt" >= ${trendingWindow}
          ) as rts_recent,
          NULL as reason 
        FROM "tweets" t
        JOIN "users" u ON u.id = t."userId"
        LEFT JOIN "medias" m ON m.id = u."profileMediaId"
        WHERE t."createdAt" >= ${sevenDaysAgo}
          AND t."userId" NOT IN (${mutedPlaceholder})
          AND t."userId" != ${params.userId}
      ),
      from_followings AS (
        SELECT *, 'from_following' as reason FROM base WHERE "userId" IN (${followingPlaceholder})
      ),
      from_2hop AS (
        SELECT *, 'from_2hop' as reason FROM base WHERE "userId" IN (${twoHopPlaceholder})
      ),
      liked_by_followings AS (
        SELECT b.*, 'liked_by_following' as reason
        FROM base b
        JOIN "TweetLike" tl on tl."tweetId" = b.id
        WHERE tl."userId" IN (${followingPlaceholder})
      ),
      -- NEW CANDIDATE SOURCE: Bookmarked by Followings
      bookmarked_by_followings AS (
        SELECT b.*, 'bookmarked_by_following' as reason
        FROM base b
        JOIN "tweetbookmarks" tb on tb."tweetId" = b.id -- Use mapped table name
        WHERE tb."userId" IN (${followingPlaceholder})
      ),
      trending AS (
        SELECT *, 'trending' as reason
        FROM base
        ORDER BY ( (likes_recent + rts_recent * 2) * 3 + (likes + rts * 2) ) DESC
        LIMIT ${CONFIG.trendingLimit}
      ),
      topic_match AS (
        SELECT b.*, 'topic' as reason FROM base b
        WHERE b.tags && ARRAY[${userHashtagPlaceholder}]::text[]
      )
      SELECT DISTINCT ON (id) *
      FROM (
        SELECT * FROM from_followings
        UNION ALL
        SELECT * FROM liked_by_followings
        UNION ALL
        SELECT * FROM bookmarked_by_followings 
        UNION ALL
        SELECT * FROM trending
        UNION ALL
        SELECT * FROM from_2hop
        UNION ALL
        SELECT * FROM topic_match
        UNION ALL
        SELECT *, 'self' as reason FROM base WHERE "userId" = ${params.userId}
        UNION ALL
        SELECT *, 'global' as reason FROM base 
      ) x
      ORDER BY id, (likes + rts * 2) DESC
      LIMIT ${CONFIG.candidateLimit}
    `;

    // fallback if nothing found: pick global trending (already covered by UNION)
    let finalCandidates = candidates ?? [];

    // 8) Filter out explicit user negatives (NotInterested, spam reports referencing tweet)
    const filtered = [];
    const notInterestedSet = new Set(notInterestedTweetIds);
    // fetch reported tweets to downweight
    let spamCounts = new Map<string, number>();
    try {
      const reports =
        (prisma as any).spamReport?.groupBy
          ? await (prisma as any).spamReport.groupBy({
              by: ["tweetId"],
              _count: { tweetId: true },
            })
          : [];
      for (const r of reports)
        spamCounts.set(r.tweetId, Number(r._count.tweetId));
    } catch {
      // if model missing, ignore
    }

    for (const c of finalCandidates) {
      if (mutedIds.includes(c.userId)) continue;
      if (blockedIds.includes(c.userId)) continue;
      if (notInterestedSet.has(c.id)) continue;
      filtered.push(c);
    }

    finalCandidates = filtered;

    // 9) Scoring: more features & reputation & spam penalty & recency
    const scored = finalCandidates.map((r: any) => {
      const createdAt = new Date(r.createdAt ?? r.created_at ?? r["createdAt"]);
      // base engagement score (raw)
      let score = baseEngagementScore({
        likes: Number(r.likes ?? r.likesCount ?? 0),
        rts: Number(r.rts ?? r.retweetCount ?? 0),
        replies: Number(r.replies ?? r.repliesCount ?? 0),
      });

      // trending velocity multiplier
      const recentEng =
        Number(r.likes_recent ?? 0) + 2 * Number(r.rts_recent ?? 0);
      const velocityBoost = 1 + Math.log1p(recentEng) * 0.08; // small multiplier for velocity
      score *= velocityBoost;

      // recency
      score *= recencyScore(createdAt);

      // follow + two-hop boosts
      if (followingIds.includes(r.userId)) score *= CONFIG.followBoost;
      else if (twoHopIds.includes(r.userId)) score *= CONFIG.twoHopBoost;

      // liked by followings boost (we preserved reason)
      if ((r.reason ?? "").includes("liked_by_following"))
        score *= CONFIG.followingLikedBoost;
      
      // NEW: bookmarked by followings boost
      if ((r.reason ?? "").includes("bookmarked_by_following"))
        score *= CONFIG.bookmarkByFollowingBoost;

      // topic overlap
      const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
      const overlap = tags.filter((t: string) =>
        userHashtags.includes(t)
      ).length;
      if (overlap > 0)
        score *= Math.pow(CONFIG.topicMatchBoost, Math.min(3, overlap));

      // verified
      const isVerified = r.verified === true || r.verified === 1;
      if (isVerified) score *= CONFIG.verifiedBoost;

      // author reputation
      const rep = authorReputation.get(r.userId) ?? 1.0;
      score *= Math.max(0.2, Math.min(CONFIG.authorReputationCap, rep));

      // spam penalty
      const spamCount = spamCounts.get(r.id) ?? 0;
      if (spamCount > 0) score /= 1 + spamCount * 0.5;

      // small random noise helps avoid deterministic tie-handling
      score = score * (1 + gaussianNoise());

      return { row: r, score, reasons: [String(r.reason ?? "")] };
    });

    // 10) sort desc by score
    scored.sort((a, b) => b.score - a.score);

    // 11) diversity & author caps
    const seenAuthors = new Map<string, number>();
    const results: any[] = [];
    for (const s of scored) {
      const id = s.row.id;
      const auth = s.row.userId;
      const current = seenAuthors.get(auth) ?? 0;
      if (current >= CONFIG.diversityAuthorLimit) continue;
      // guard: if author reputation extremely low skip
      const rep = authorReputation.get(auth) ?? 1.0;
      if (rep < 0.3) continue;
      seenAuthors.set(auth, current + 1);
      results.push({ ...s.row, _score: s.score, _reasons: s.reasons });
      if (results.length >= limit * 3) break;
    }

    // 12) final sort & pagination
    results.sort((a, b) => b._score - a._score);

    let startIndex = 0;
    if (params.cursor) {
      const idx = results.findIndex((r) => r.id === params.cursor);
      if (idx >= 0) startIndex = idx + 1;
    }
    const page = results.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < results.length
        ? results[startIndex + limit].id
        : null;

    // Map to DTO
    const items = page.map((r) =>
      mapRowToDTO({
        id: r.id,
        content: r.content,
        userId: r.userId,
        username: r.username ?? r.user?.username,
        name: r.name ?? r.user?.name,
        profileMediaKey:
          r.profileMediaKey ?? r.user?.profileMedia?.keyName ?? null,
        createdAt: new Date(r.createdAt ?? r.created_at),
        likesCount: r.likes ?? r.likesCount ?? 0,
        retweetCount: r.rts ?? r.retweetCount ?? 0,
        repliesCount: r.replies ?? r.repliesCount ?? 0,
        _score: r._score ?? r._score ?? 0,
        _reasons:
          r._reasons ?? r._reasons ?? r.reason ? [String(r.reason)] : [],
      })
    );

    const response: ForYouResponseDTO = {
      user: params.userId,
      recommendations: items,
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // Cache for a short time
    await cacheSet(cacheKey, response, CONFIG.cacheTTL);

    return response;
  }
}