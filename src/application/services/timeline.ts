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

// ================================================================================== //

// src/application/services/timeline.ts - Consolidated and Enhanced
import { prisma } from "@/prisma/client";
import { Prisma } from "@prisma/client";
import Redis from "ioredis";

// --- START: Original Redis/Cache Utils (Kept as is) ---
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
// --- END: Original Redis/Cache Utils ---

/* ---------------------------
 * New Types & DTOs (Modified to match target JSON)
 * --------------------------- */

interface UserMediaDTO {
  id: string;
}

interface UserDTO {
  id: string;
  name: string | null;
  username: string;
  profileMedia: UserMediaDTO | null;
  verified: boolean;
  protectedAccount: boolean;
  // Note: 'retweets' data structure is complex and will be simplified or omitted
  // in the scope of this response to focus on the main timeline item structure.
  // Including an empty placeholder for now.
  retweets?: {
    data: { id: string; name: string | null; username: string }[];
    nextCursor: string | null;
  };
}

interface TimelineItemDTO {
  id: string;
  content: string | null;
  createdAt: string;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  quotesCount: number;
  replyControl: string; // Added: from Tweet model
  parentId?: string | null;
  tweetType: string;
  user: UserDTO; // Modified: now a full UserDTO
  mediaIds: string[]; // Added: list of media IDs
  isLiked: boolean; // Added: current user's interaction
  isRetweeted: boolean; // Added: current user's interaction
  isBookmarked: boolean; // Added: current user's interaction
  score: number;
  reasons: string[];
  // Optional: For the nested structure requirement (retweets, etc.) - keep simple for now
  retweets?: {
    data: {
      id: string;
      name: string | null;
      username: string;
      profileMedia: UserMediaDTO | null;
      verified: boolean;
      protectedAccount: boolean;
    }[];
    nextCursor: string | null;
  };
}

// Updated based on your target JSON
interface TimelineResponse {
  user: string;
  items: TimelineItemDTO[];
  nextCursor: string | null;
  generatedAt: string;
}

// Updated based on your target JSON
interface ForYouResponseDTO extends TimelineResponse {
  recommendations: TimelineItemDTO[]; // Kept for compatibility with original ForYou DTO
}

type TimelineParams = {
  userId: string;
  limit?: number;
  cursor?: string;
  includeThreads?: boolean;
};
type ForYouParams = { userId: string; limit?: number; cursor?: string };


/**
 * TUNABLE constants — adjusted/merged to support both feeds.
 */
const CONFIG = {
  // Common
  cacheTTL: 8, // seconds
  randomNoiseStddev: 0.015,
  authorReputationCap: 2.0,
  diversityAuthorLimit: 3, // max items per author in final page (adjusted from 2 to 3)

  // For You Feed Specific
  recencyHalfLifeHours_FY: 18, // tighter decay -> fresher items favored
  engagementWeights_FY: { like: 1.0, retweet: 2.2, reply: 0.8 }, // adjust curve
  followBoost: 2.6,
  twoHopBoost: 1.25,
  followingLikedBoost: 1.7,
  bookmarkByFollowingBoost: 1.5,
  topicMatchBoost: 1.9,
  verifiedBoost_FY: 1.12,
  candidateLimit_FY: 1500,
  trendingLimit_FY: 300,
  trendingWindowHours: 48,
  authorReputationFloor_FY: 0.2,

  // Following Feed Specific
  recencyHalfLifeHours_F: 24, // softer decay for following timeline
  engagementWeights_F: { like: 1.0, retweet: 2.3, reply: 0.9, quote: 1.2 },
  retweetByFollowingBoost: 1.05,
  quoteByFollowingBoost: 1.03,
  velocityBoostFactor: 0.06,
  verifiedBoost_F: 1.08,
  authorReputationFloor_F: 0.25,
  candidateLimit_F: 1200,
  spamReportPenaltyPerReport: 0.5,
  threadIncludeLimit: 3,
};

/* ---------------------------
 * Math / Helpers (Kept as is)
 * --------------------------- */

function recencyScore(createdAt: Date, halfLifeHours: number) {
  // exponential half-life: 2^(-age/halfLife)
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return Math.pow(2, -ageHours / halfLifeHours);
}

function baseEngagementScore_FY(tweet: { likes: number; rts: number; replies: number; }) {
  return (
    tweet.likes * CONFIG.engagementWeights_FY.like +
    tweet.rts * CONFIG.engagementWeights_FY.retweet +
    tweet.replies * CONFIG.engagementWeights_FY.reply
  );
}

function baseEngagementScore_F(t: { likes: number; rts: number; replies: number; quotes: number }) {
  return (
    t.likes * CONFIG.engagementWeights_F.like +
    t.rts * CONFIG.engagementWeights_F.retweet +
    t.replies * CONFIG.engagementWeights_F.reply +
    t.quotes * CONFIG.engagementWeights_F.quote
  );
}

function gaussianNoise(std = CONFIG.randomNoiseStddev) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random() || 1e-9;
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std;
}

// MODIFIED: to map all new fields
function mapToDTO(row: any, score = 0, reasons: string[] = []): TimelineItemDTO {
  // Helper to map a raw SQL result row (or a full tweet object) to the DTO structure.
  
  // Normalize row data for counts and general tweet fields
  const likesCount = Number(row.likes ?? row.likesCount ?? 0);
  const retweetCount = Number(row.rts ?? row.retweetCount ?? 0);
  const repliesCount = Number(row.replies ?? row.repliesCount ?? 0);
  const quotesCount = Number(row.quotes ?? row.quotesCount ?? 0);
  const createdAt = (row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString());

  // Handle User Object (can come from SQL result join or Prisma include)
  const userData = row.user ?? {
    id: row.userId,
    username: row.username,
    name: row.name,
    verified: row.verified,
    protectedAccount: row.protectedAccount,
    profileMedia: row.profileMediaId ? { id: row.profileMediaId } : (
        row.profileMediaKey ? { id: row.profileMediaKey } : null
    )
  };
  
  // Handle Interaction Status (from custom select fields in the queries)
  const isLiked = row.isLiked === true || row.isLiked === 1;
  const isRetweeted = row.isRetweeted === true || row.isRetweeted === 1;
  const isBookmarked = row.isBookmarked === true || row.isBookmarked === 1;

  // Handle Media IDs
  const mediaIds: string[] = Array.isArray(row.mediaIds) ? row.mediaIds : [];
  
  // Handle User Profile Media (if it was an include, it's nested)
  let profileMediaDTO: UserMediaDTO | null = null;
  if (userData.profileMediaId) {
      profileMediaDTO = { id: userData.profileMediaId };
  } else if (userData.profileMedia?.id) {
      profileMediaDTO = { id: userData.profileMedia.id };
  } else if (userData.profileMedia?.keyName) {
      // In the SQL query, we used keyName, which is not the ID.
      // Need a robust way. For now, rely on `profileMediaId` from SQL or nested `user.profileMedia` from Prisma.
      profileMediaDTO = userData.profileMedia ? { id: userData.profileMedia.id ?? userData.profileMedia.keyName } : null;
  }
  
  // Construct the final UserDTO
  const userDTO: UserDTO = {
      id: userData.id,
      name: userData.name ?? null,
      username: userData.username ?? '',
      profileMedia: profileMediaDTO,
      verified: userData.verified ?? false,
      protectedAccount: userData.protectedAccount ?? false,
      // Leaving retweets as a placeholder, as fetching full retweets data for every item 
      // is complex and usually done in a separate endpoint.
      retweets: { data: [], nextCursor: null } 
  };
  
  return {
    id: row.id,
    content: row.content ?? null,
    createdAt: createdAt,
    likesCount: likesCount,
    retweetCount: retweetCount,
    repliesCount: repliesCount,
    quotesCount: quotesCount,
    replyControl: row.replyControl ?? 'EVERYONE', // Added
    parentId: row.parentId ?? row.parent_id ?? null,
    tweetType: String(row.tweetType ?? row.tweet_type ?? "TWEET"),
    user: userDTO, // Updated
    mediaIds: mediaIds, // Added
    isLiked: isLiked, // Added
    isRetweeted: isRetweeted, // Added
    isBookmarked: isBookmarked, // Added
    score: Number(row._score ?? score),
    reasons: row._reasons ?? reasons,
  };
}


/* ---------------------------
 * Service
 * --------------------------- */

// Helper to get interaction status (Likes, Retweets, Bookmarks) and Media IDs for a list of Tweet IDs
async function getTweetInteractionAndMedia(
    tweetIds: string[],
    userId: string
): Promise<Map<string, { isLiked: boolean; isRetweeted: boolean; isBookmarked: boolean; mediaIds: string[] }>> {
    if (tweetIds.length === 0) return new Map();

    const tweetIdPlaceholder = Prisma.join(tweetIds.map((id) => Prisma.sql`${id}`), ",");

    const rawInteractionData = await prisma.$queryRaw<any[]>`
        SELECT 
            t.id,
            (SELECT COUNT(*) FROM "TweetLike" tl WHERE tl."tweetId" = t.id AND tl."userId" = ${userId}) > 0 as "isLiked",
            (SELECT COUNT(*) FROM "Retweet" rt WHERE rt."tweetId" = t.id AND rt."userId" = ${userId}) > 0 as "isRetweeted",
            (SELECT COUNT(*) FROM "tweetbookmarks" tb WHERE tb."tweetId" = t.id AND tb."userId" = ${userId}) > 0 as "isBookmarked",
            (
                SELECT ARRAY_AGG("mediaId")
                FROM "TweetMedia" tm
                WHERE tm."tweetId" = t.id
            ) as "mediaIds"
        FROM "tweets" t
        WHERE t.id IN (${tweetIdPlaceholder})
    `;

    const interactionMap = new Map<string, { isLiked: boolean; isRetweeted: boolean; isBookmarked: boolean; mediaIds: string[] }>();
    for (const row of rawInteractionData) {
        interactionMap.set(row.id, {
            isLiked: Boolean(row.isLiked),
            isRetweeted: Boolean(row.isRetweeted),
            isBookmarked: Boolean(row.isBookmarked),
            mediaIds: row.mediaIds ?? [],
        });
    }

    return interactionMap;
}

// Function to fetch full Tweet/User data from candidate IDs
async function fetchFullTweetData(candidateRows: any[], currentUserId: string): Promise<any[]> {
    const candidateIds = candidateRows.map(r => r.id);
    if (candidateIds.length === 0) return [];
    
    // 1. Fetch Interactions and Media IDs
    const interactionMap = await getTweetInteractionAndMedia(candidateIds, currentUserId);

    // 2. Fetch full Tweets + User data
    const fullTweets = await prisma.tweet.findMany({
        where: {
            id: { in: candidateIds }
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    verified: true,
                    protectedAccount: true,
                    profileMedia: { select: { id: true, keyName: true } },
                }
            },
            // We use the raw query result for base counts, but we need the Prisma structure for replyControl and parentId
            // The candidate rows already contain base tweet info, so we mainly need the user object and missing fields.
        }
    });

    const fullTweetMap = new Map(fullTweets.map(t => [t.id, t]));
    
    // 3. Merge data
    return candidateRows.map(c => {
        const fullTweet = fullTweetMap.get(c.id);
        const interactions = interactionMap.get(c.id) ?? { isLiked: false, isRetweeted: false, isBookmarked: false, mediaIds: [] };
        
        // Merge the rich user data and interaction status back into the candidate row
        return {
            ...c, 
            ...fullTweet, // Overwrite with rich tweet data (for replyControl, user object, etc.)
            user: fullTweet?.user, // Use the rich user object from the include
            isLiked: interactions.isLiked,
            isRetweeted: interactions.isRetweeted,
            isBookmarked: interactions.isBookmarked,
            mediaIds: interactions.mediaIds,
            // Ensure counts are used from the richer data if present, or fallback
            likesCount: fullTweet?.likesCount ?? c.likesCount,
            retweetCount: fullTweet?.retweetCount ?? c.retweetCount,
            repliesCount: fullTweet?.repliesCount ?? c.repliesCount,
            quotesCount: fullTweet?.quotesCount ?? c.quotesCount,
        };
    });
}


export class TimelineService {
  /**
   * getTimeline (Following Feed) - Enhanced with scoring and ranking
   */
  async getTimeline(params: TimelineParams): Promise<TimelineResponse> {
    const limit = params.limit ?? 20;
    const cacheKey = `following:${params.userId}:l${limit}:c${params.cursor ?? "none"}`;

    // 0) Try cache
    try {
      const cached = await cacheGet<TimelineResponse>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      // silently ignore cache errors
    }

    // 1) get followings
    const followRows = await prisma.follow.findMany({
      where: { followerId: params.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });
    const followingIds = followRows.map((r) => r.followingId);

    if (followingIds.length === 0) {
      const empty: TimelineResponse = { user: params.userId, items: [], nextCursor: null, generatedAt: new Date().toISOString() };
      await cacheSet(cacheKey, empty, CONFIG.cacheTTL).catch(() => {});
      return empty;
    }

    // 2) negative signals: muted, blocked, notInterested
    const [mutedRows, blockedRows] = await Promise.all([
      prisma.mute.findMany({ where: { muterId: params.userId }, select: { mutedId: true } }),
      prisma.block.findMany({ where: { blockerId: params.userId }, select: { blockedId: true } }),
    ]);
    const mutedIds = new Set(mutedRows.map((r) => r.mutedId));
    const blockedIds = new Set(blockedRows.map((r) => r.blockedId));

    const notInterestedRows = await prisma.notInterested.findMany({
      where: { userId: params.userId },
      select: { tweetId: true },
    });
    const notInterestedSet = new Set(notInterestedRows.map((r) => r.tweetId));

    // 3) spam report counts (grouped)
    const spamGroups = await prisma.spamReport.groupBy({
      by: ["tweetId"],
      _count: { tweetId: true },
    });
    const spamCounts = new Map<string, number>();
    for (const g of spamGroups) spamCounts.set(g.tweetId, Number(g._count.tweetId));

    // 4) Candidate generation (raw SQL)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWindow = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h for velocity

    const followingPlaceholder = Prisma.join(followingIds.map((id) => Prisma.sql`${id}`), ",");
    const mutedPlaceholder = mutedIds.size ? Prisma.join(Array.from(mutedIds).map((id) => Prisma.sql`${id}`), ",") : Prisma.sql`'__null__'`;

    // MODIFIED: Added u.protectedAccount, u.reputation, t.replyControl to base_tweets
    const rawCandidates = await prisma.$queryRaw<any[]>`
      WITH
      base_tweets AS (
        SELECT t.*,
               u.username,
               u.name,
               u."profileMediaId",
               u.verified,
               u."protectedAccount", -- ADDED
               m."keyName" as "profileMediaKey",
               COALESCE(t."likesCount",0) AS likes,
               COALESCE(t."retweetCount",0) AS rts,
               COALESCE(t."repliesCount",0) AS replies,
               COALESCE(t."quotesCount",0) AS quotes,
               t."replyControl", -- ADDED
               u.reputation, 
               (
                 SELECT COUNT(*) FROM "TweetLike" tl WHERE tl."tweetId" = t.id AND tl."createdAt" >= ${recentWindow}
               ) as likes_recent,
               (
                 SELECT COUNT(*) FROM "Retweet" rt WHERE rt."tweetId" = t.id AND rt."createdAt" >= ${recentWindow}
               ) as rts_recent,
               (
                 SELECT ARRAY_AGG(h."tag_text")
                 FROM "tweetHashes" th
                 JOIN "hashes" h on h.id = th."hashId"
                 WHERE th."tweetId" = t.id
               ) as tags
        FROM "tweets" t
        JOIN "users" u on u.id = t."userId"
        LEFT JOIN "medias" m on m.id = u."profileMediaId"
        WHERE t."createdAt" >= ${sevenDaysAgo}
          AND t."userId" IN (${followingPlaceholder})
          AND t."userId" NOT IN (${mutedPlaceholder})
      ),
      retweeted AS (
        SELECT t.*, 'retweet_by_following' as reason, r."userId" as retweeterId, r."createdAt" as retweetAt
        FROM "Retweet" r
        JOIN "tweets" t on t.id = r."tweetId"
        WHERE r."userId" IN (${followingPlaceholder})
          AND r."createdAt" >= ${sevenDaysAgo}
      ),
      quotes_by_followings AS (
        SELECT q.*, 'quote_by_following' as reason, q."userId" as quoteAuthorId
        FROM "tweets" q
        WHERE q."userId" IN (${followingPlaceholder})
          AND q."tweetType" = 'QUOTE'
          AND q."createdAt" >= ${sevenDaysAgo}
      ),
      trending_in_followings AS (
        SELECT bt.*, 'trending' as reason
        FROM base_tweets bt
        ORDER BY ( (bt.likes_recent + bt.rts_recent * 2) * 3 + (bt.likes + bt.rts * 2) ) DESC
        LIMIT 300
      )
      SELECT DISTINCT ON (id) *
      FROM (
        SELECT *, 'from_following' as reason FROM base_tweets
        UNION ALL
        SELECT r.*, bt.username, bt.name, bt."profileMediaId", bt.verified, bt."protectedAccount", bt."profileMediaKey", bt.likes, bt.rts, bt.replies, bt.quotes, bt."replyControl", bt.reputation, bt.likes_recent, bt.rts_recent, bt.tags FROM retweeted r JOIN base_tweets bt ON r."tweetId" = bt.id -- join with base to get extra info like counts and user data
        UNION ALL
        SELECT * FROM quotes_by_followings
        UNION ALL
        SELECT * FROM trending_in_followings
      ) pool
      ORDER BY id, (likes + rts*2) DESC
      LIMIT ${CONFIG.candidateLimit_F}
    `;

    if (!rawCandidates || rawCandidates.length === 0) {
      const empty: TimelineResponse = { user: params.userId, items: [], nextCursor: null, generatedAt: new Date().toISOString() };
      try { await cacheSet(cacheKey, empty, CONFIG.cacheTTL); } catch {}
      return empty;
    }

    // 5) Filter explicit negatives (Kept as is)
    const filteredCandidates = rawCandidates.filter((c) => {
      if (blockedIds.has(c.userId)) return false;
      if (notInterestedSet.has(c.id)) return false;
      if (c.reason === "retweet_by_following" && blockedIds.has(c.retweeterid)) return false;
      if (c.reason === "quote_by_following" && blockedIds.has(c.quoteauthorid)) return false;
      return true;
    });

    // 6) Score candidates (Kept as is)
    const scored = filteredCandidates.map((r: any) => {
      const createdAt = new Date(r.createdAt ?? r.created_at ?? new Date());

      const base = baseEngagementScore_F({
        likes: Number(r.likes ?? 0), rts: Number(r.rts ?? 0),
        replies: Number(r.replies ?? 0), quotes: Number(r.quotes ?? 0),
      });

      const recentEng = Number(r.likes_recent ?? 0) + 2 * Number(r.rts_recent ?? 0);
      const velocityMultiplier = 1 + Math.log1p(recentEng) * CONFIG.velocityBoostFactor;

      let score = (base + 1) * velocityMultiplier; // +1 to avoid zero scores

      // recency
      score *= recencyScore(createdAt, CONFIG.recencyHalfLifeHours_F);

      // boosts
      if (String(r.reason)?.includes("retweet_by_following")) score *= CONFIG.retweetByFollowingBoost;
      if (String(r.reason)?.includes("quote_by_following")) score *= CONFIG.quoteByFollowingBoost;

      // verified
      if (r.verified === true || r.verified === 1) score *= CONFIG.verifiedBoost_F;

      // author reputation
      let authorReputation = Number(r.reputation ?? 1.0);
      authorReputation = Math.max(CONFIG.authorReputationFloor_F, Math.min(CONFIG.authorReputationCap, authorReputation));
      score *= authorReputation;

      // spam penalty
      const spamCount = spamCounts.get(r.id) ?? 0;
      if (spamCount > 0) score /= (1 + spamCount * CONFIG.spamReportPenaltyPerReport);

      // small noise
      score = score * (1 + gaussianNoise());

      const reasons = [String(r.reason ?? "from_following")];
      return { row: r, score, reasons };
    });

    // 7) Sort by score desc (Kept as is)
    scored.sort((a, b) => b.score - a.score);

    // 8) Diversity & author capping (Kept as is)
    const scoredCandidatesWithBaseInfo: any[] = scored.map(s => ({ ...s.row, _score: s.score, _reasons: s.reasons }));
    
    const seenAuthors = new Map<string, number>();
    const diversifiedResults: any[] = [];
    
    for (const item of scoredCandidatesWithBaseInfo) {
      const author = item.userId;
      const authorCount = seenAuthors.get(author) ?? 0;
      if (authorCount >= CONFIG.diversityAuthorLimit) continue;
      
      const rep = Number(item.reputation ?? 1.0);
      if (rep < CONFIG.authorReputationFloor_F) continue;

      diversifiedResults.push(item);
      seenAuthors.set(author, authorCount + 1);

      if (diversifiedResults.length >= limit * 4) break;
    }

    // MODIFIED: Fetch full tweet data *after* filtering
    let results = await fetchFullTweetData(diversifiedResults, params.userId);

    // Optional: expand threads (Modified to use richer includes)
    if (params.includeThreads) {
      const parentIds = new Set<string>();
      for (const res of results) {
        if (res.parentId && !results.some(r => r.id === res.parentId)) parentIds.add(res.parentId);
      }

      if (parentIds.size > 0) {
        const parentList = Array.from(parentIds).slice(0, 200);
        const parents = await prisma.tweet.findMany({
          where: { id: { in: parentList } },
          include: {
            user: { select: { id: true, username: true, name: true, profileMedia: { select: { id: true, keyName: true } }, verified: true, protectedAccount: true } },
            tweetMedia: { select: { mediaId: true } }, // To get mediaIds
            tweetLikes: { where: { userId: params.userId }, select: { userId: true } }, // Check like status
            retweets: { where: { userId: params.userId }, select: { userId: true } }, // Check retweet status
            tweetBookmark: { where: { userId: params.userId }, select: { userId: true } }, // Check bookmark status
          },
        });

        for (const p of parents) {
          const authorCount = seenAuthors.get(p.userId) ?? 0;
          if (authorCount >= CONFIG.diversityAuthorLimit) continue;
          
          // Map the parent tweet data to a structure similar to the merged results
          const parentItem = {
              ...p,
              _score: Number.MAX_SAFE_INTEGER / 10,
              _reasons: ["thread_parent"],
              likesCount: p.tweetLikes.length, // use the actual count from the fetched data
              retweetCount: p.retweets.length, // use the actual count from the fetched data
              quotesCount: p.quotesCount,
              repliesCount: p.repliesCount,
              isLiked: p.tweetLikes.length > 0,
              isRetweeted: p.retweets.length > 0,
              isBookmarked: p.tweetBookmark.length > 0,
              mediaIds: p.tweetMedia.map(tm => tm.mediaId),
              // User object is already nested correctly from the include
          }
          
          // Use unshift to put parents at the top (highest score)
          results.unshift(parentItem);
          seenAuthors.set(p.userId, authorCount + 1);
        }
      }
    }

    // 9) Final sort & pagination (Kept as is, using the final `results` array)
    results.sort((a, b) => {
      const sa = Number(a._score ?? 0);
      const sb = Number(b._score ?? 0);
      if (sb !== sa) return sb - sa;
      return new Date(b.createdAt ?? b.created_at).getTime() - new Date(a.createdAt ?? a.created_at).getTime();
    });

    let startIndex = 0;
    if (params.cursor) {
      const idx = results.findIndex((r) => r.id === params.cursor);
      if (idx >= 0) startIndex = idx + 1;
    }
    const pageSlice = results.slice(startIndex, startIndex + limit);
    const nextCursor = (startIndex + limit) < results.length ? results[startIndex + limit].id : null;

    // MODIFIED: mapToDTO handles the full object now
    const items = pageSlice.map((r) =>
      mapToDTO(r, Number(r._score ?? 0), r._reasons ?? [String(r.reason ?? "")])
    );

    const response: TimelineResponse = {
      user: params.userId,
      items,
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // 10) Cache briefly
    try { await cacheSet(cacheKey, response, CONFIG.cacheTTL); } catch {}

    return response;
  }

  /**
   * getForYou - remains largely the same, using its own tuning constants
   */
  async getForYou(params: ForYouParams): Promise<ForYouResponseDTO> {
    const limit = params.limit ?? 20;
    const cacheKey = `for-you:${params.userId}:l${limit}:c${
      params.cursor ?? "none"
    }`;

    // 1) Try cache
    const cached = await cacheGet<ForYouResponseDTO>(cacheKey);
    if (cached) return cached;

    // 2) Followings (Kept as is)
    const followRows = await prisma.follow.findMany({
      where: { followerId: params.userId, status: "ACCEPTED" },
      select: { followingId: true },
    });
    const followingIds = followRows.map((r) => r.followingId);

    // 3) two-hop followings (up to 200) (Kept as is)
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

    // 4) Negative signals: muted, blocked, not interested, spam reports (Kept as is)
    const [mutedRows, blockedRows] = await Promise.all([
      prisma.mute.findMany({ where: { muterId: params.userId }, select: { mutedId: true } }),
      prisma.block.findMany({ where: { blockerId: params.userId }, select: { blockedId: true } }),
    ]);
    const mutedIds = mutedRows.map((r) => r.mutedId);
    const blockedIds = blockedRows.map((r) => r.blockedId);

    let notInterestedTweetIds: string[] = [];
    try {
      const ni = await (prisma as any).notInterested.findMany({
        where: { userId: params.userId },
        select: { tweetId: true },
      });
      interface NotInterestedRow { tweetId: string; }
      notInterestedTweetIds = (ni as NotInterestedRow[]).map((r) => r.tweetId);
    } catch {
      notInterestedTweetIds = [];
    }

    // 5) Author reputation (graceful) (Kept as is)
    let authorReputation = new Map<string, number>();
    try {
      // NOTE: User model now has reputation field, this check is for backwards compatibility
      // with a standalone AuthorReputation model. If it exists, use it, otherwise rely 
      // on the 'reputation' column from the User join in the SQL below.
      const reputations = (prisma as any).authorReputation?.findMany
        ? await (prisma as any).authorReputation.findMany()
        : [];
      interface AuthorReputationRow { userId: string; score?: number | string | null; }
      const reputationsTyped = reputations as AuthorReputationRow[];
      reputationsTyped.forEach((r: AuthorReputationRow) =>
        authorReputation.set(r.userId, Number(r.score ?? 1.0))
      );
    } catch {
      // ignore if not present or any runtime error
    }

    // 6) Top user topics (hashtags) (Kept as is)
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

    // 7) Candidate generation (raw SQL)
    const trendingWindow = new Date(
      Date.now() - CONFIG.trendingWindowHours * 60 * 60 * 1000
    );
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const mutedPlaceholder = mutedIds.length
      ? Prisma.join(mutedIds.map((id) => Prisma.sql`${id}`), ",")
      : Prisma.sql`'__null__'`;
    const followingPlaceholder = followingIds.length
      ? Prisma.join(followingIds.map((id) => Prisma.sql`${id}`), ",")
      : Prisma.sql`'__null__'`;
    const twoHopPlaceholder = twoHopIds.length
      ? Prisma.join(twoHopIds.map((id) => Prisma.sql`${id}`), ",")
      : Prisma.sql`'__null__'`;
    const userHashtagPlaceholder = userHashtags.length
      ? Prisma.join(userHashtags.map((h) => Prisma.sql`${h}`), ",")
      : Prisma.sql`'__null__'`;

    // MODIFIED: Added u.protectedAccount, u.reputation, t.replyControl to base
    const candidates = await prisma.$queryRaw<any[]>`
      WITH base AS (
        SELECT
          t.*,
          u.username,
          u.name,
          u."profileMediaId",
          u.verified,
          u."protectedAccount", -- ADDED
          u.reputation, -- ADDED
          m."keyName" as "profileMediaKey",
          COALESCE(t."likesCount",0) as likes,
          COALESCE(t."retweetCount",0) as rts,
          COALESCE(t."repliesCount",0) as replies,
          t."replyControl", -- ADDED
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
        LIMIT ${CONFIG.trendingLimit_FY}
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
      LIMIT ${CONFIG.candidateLimit_FY}
    `;

    let finalCandidates = candidates ?? [];

    // 8) Filter out explicit user negatives (NotInterested, spam reports referencing tweet) (Kept as is)
    const filtered = [];
    const notInterestedSet = new Set(notInterestedTweetIds);
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

    // 9) Scoring: (Kept as is)
    const scored = finalCandidates.map((r: any) => {
      const createdAt = new Date(r.createdAt ?? r.created_at ?? r["createdAt"]);
      let score = baseEngagementScore_FY({
        likes: Number(r.likes ?? r.likesCount ?? 0),
        rts: Number(r.rts ?? r.retweetCount ?? 0),
        replies: Number(r.replies ?? r.repliesCount ?? 0),
      });

      const recentEng =
        Number(r.likes_recent ?? 0) + 2 * Number(r.rts_recent ?? 0);
      const velocityBoost = 1 + Math.log1p(recentEng) * 0.08;
      score *= velocityBoost;

      // recency
      score *= recencyScore(createdAt, CONFIG.recencyHalfLifeHours_FY);

      // follow + two-hop boosts
      if (followingIds.includes(r.userId)) score *= CONFIG.followBoost;
      else if (twoHopIds.includes(r.userId)) score *= CONFIG.twoHopBoost;

      // liked by followings boost
      if ((r.reason ?? "").includes("liked_by_following"))
        score *= CONFIG.followingLikedBoost;
      
      // bookmarked by followings boost
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
      if (isVerified) score *= CONFIG.verifiedBoost_FY;

      // author reputation
      const repFromMap = authorReputation.get(r.userId) ?? 1.0;
      // Use reputation from the joined User table if it exists and map is empty
      const rep = (repFromMap === 1.0 && r.reputation) ? Number(r.reputation) : repFromMap;
      
      score *= Math.max(CONFIG.authorReputationFloor_FY, Math.min(CONFIG.authorReputationCap, rep));

      // spam penalty
      const spamCount = spamCounts.get(r.id) ?? 0;
      if (spamCount > 0) score /= 1 + spamCount * 0.5;

      // small random noise
      score = score * (1 + gaussianNoise());

      return { row: r, score, reasons: [String(r.reason ?? "")] };
    });

    // 10) sort desc by score (Kept as is)
    scored.sort((a, b) => b.score - a.score);

    // 11) diversity & author caps (Kept as is)
    const scoredCandidatesWithBaseInfo: any[] = scored.map(s => ({ ...s.row, _score: s.score, _reasons: s.reasons }));
    
    const seenAuthors = new Map<string, number>();
    const diversifiedResults: any[] = [];
    
    for (const s of scoredCandidatesWithBaseInfo) {
      const auth = s.userId;
      const current = seenAuthors.get(auth) ?? 0;
      if (current >= CONFIG.diversityAuthorLimit) continue;
      
      const repFromMap = authorReputation.get(auth) ?? 1.0;
      const rep = (repFromMap === 1.0 && s.reputation) ? Number(s.reputation) : repFromMap;

      if (rep < CONFIG.authorReputationFloor_FY) continue;
      
      seenAuthors.set(auth, current + 1);
      diversifiedResults.push(s);
      if (diversifiedResults.length >= limit * 3) break;
    }

    // MODIFIED: Fetch full tweet data *after* filtering
    let results = await fetchFullTweetData(diversifiedResults, params.userId);

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

    // MODIFIED: Map to DTO
    const items = page.map((r) =>
      mapToDTO(r, Number(r._score ?? 0), r._reasons ?? [String(r.reason ?? "")])
    );

    const response: ForYouResponseDTO = {
      user: params.userId,
      recommendations: items, // recommendations field for original DTO compatibility
      items, // items field for TimelineResponse compatibility
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // Cache for a short time
    await cacheSet(cacheKey, response, CONFIG.cacheTTL);

    return response;
  }
}