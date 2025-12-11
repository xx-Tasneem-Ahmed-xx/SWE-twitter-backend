// src/application/services/timeline.ts
import { prisma } from "@/prisma/client";
import { Prisma } from "@prisma/client";
import Redis from "ioredis";
import {
  TimelineParams,
  ForYouParams,
  TimelineResponse,
  ForYouResponseDTO,
  CONFIG,
  InteractionMap,
  InteractionData,
} from "../dtos/timeline/timeline.dto";
import {
  UserMediaDTO,
  UserDTO,
  EmbeddedTweetDTO,
  TimelineItemDTO,
} from "../dtos/timeline/timeline.dto.schema";

// --- START: Original Redis/Cache Utils ---
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
 * Math / Helpers
 * --------------------------- */

export function recencyScore(createdAt: Date, halfLifeHours: number) {
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return Math.pow(2, -ageHours / halfLifeHours);
}

export function baseEngagementScore_FY(tweet: {
  likes: number;
  rts: number;
  replies: number;
}) {
  return (
    tweet.likes * CONFIG.engagementWeights_FY.like +
    tweet.rts * CONFIG.engagementWeights_FY.retweet +
    tweet.replies * CONFIG.engagementWeights_FY.reply
  );
}

export function baseEngagementScore_F(t: {
  likes: number;
  rts: number;
  replies: number;
  quotes: number;
}) {
  return (
    t.likes * CONFIG.engagementWeights_F.like +
    t.rts * CONFIG.engagementWeights_F.retweet +
    t.replies * CONFIG.engagementWeights_F.reply +
    t.quotes * CONFIG.engagementWeights_F.quote
  );
}

export function gaussianNoise(std = CONFIG.randomNoiseStddev) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random() || 1e-9;
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std;
}

// MODIFIED: Added `parentTweetData` parameter
export function mapToDTO(
  row: any,
  score = 0,
  reasons: string[] = [],
  parentTweetData?: any
): TimelineItemDTO {
  // Normalize row data
  const likesCount = Number(row.likes ?? row.likesCount ?? 0);
  const retweetCount = Number(row.rts ?? row.retweetCount ?? 0);
  const repliesCount = Number(row.replies ?? row.repliesCount ?? 0);
  const quotesCount = Number(row.quotes ?? row.quotesCount ?? 0);
  const createdAt = row.createdAt
    ? new Date(row.createdAt).toISOString()
    : new Date().toISOString();

  // Handle User Object
  const userData = row.user ?? {
    id: row.userId,
    username: row.username,
    name: row.name,
    verified: row.verified,
    protectedAccount: row.protectedAccount,
  };

  // Handle Interaction Status
  const isLiked = row.isLiked === true || row.isLiked === 1;
  const isRetweeted = row.isRetweeted === true || row.isRetweeted === 1;
  const isBookmarked = row.isBookmarked === true || row.isBookmarked === 1;

  // Handle Media IDs
  const mediaIds: string[] = Array.isArray(row.mediaIds) ? row.mediaIds : [];

  // Determine profileMediaDTO
  let profileMediaDTO: UserMediaDTO | null = null;
  if (userData.profileMediaId) {
    profileMediaDTO = { id: userData.profileMediaId };
  } else if (userData.profileMedia?.id) {
    profileMediaDTO = { id: userData.profileMedia.id };
  } else if (userData.profileMedia?.keyName) {
    profileMediaDTO = { id: userData.profileMedia.keyName };
  }

  // Construct the final UserDTO
  const userDTO: UserDTO = {
    id: userData.id,
    name: userData.name ?? null,
    username: userData.username ?? "",
    profileMedia: profileMediaDTO,
    verified: userData.verified ?? false,
    protectedAccount: userData.protectedAccount ?? false,
    retweets: { data: [], nextCursor: null },
  };

  // Handle Embedded Parent Tweet
  let embeddedParent: EmbeddedTweetDTO | null = null;
  if (parentTweetData) {
    const parentUserDTO: UserDTO = {
      id: parentTweetData.user.id,
      name: parentTweetData.user.name ?? null,
      username: parentTweetData.user.username ?? "",
      verified: parentTweetData.user.verified ?? false,
      protectedAccount: parentTweetData.user.protectedAccount ?? false,
      profileMedia: parentTweetData.user.profileMedia?.id
        ? { id: parentTweetData.user.profileMedia.id }
        : null,
      retweets: { data: [], nextCursor: null },
    };

    embeddedParent = {
      id: parentTweetData.id,
      content: parentTweetData.content ?? null,
      createdAt: parentTweetData.createdAt
        ? new Date(parentTweetData.createdAt).toISOString()
        : new Date().toISOString(),
      likesCount: Number(parentTweetData.likesCount ?? 0),
      retweetCount: Number(parentTweetData.retweetCount ?? 0),
      repliesCount: Number(parentTweetData.repliesCount ?? 0),
      quotesCount: Number(parentTweetData.quotesCount ?? 0),
      replyControl: parentTweetData.replyControl ?? "EVERYONE",
      tweetType: String(parentTweetData.tweetType ?? "TWEET"),
      userId: parentTweetData.userId,
      user: parentUserDTO,
      mediaIds: parentTweetData.mediaIds ?? [],
    };
  }

  return {
    id: row.id,
    content: row.content ?? null,
    createdAt: createdAt,
    likesCount: likesCount,
    retweetCount: retweetCount,
    repliesCount: repliesCount,
    quotesCount: quotesCount,
    replyControl: row.replyControl ?? "EVERYONE",
    parentId: row.parentId ?? row.parent_id ?? null,
    tweetType: String(row.tweetType ?? row.tweet_type ?? "TWEET"),
    user: userDTO,
    mediaIds: mediaIds,
    isLiked: isLiked,
    isRetweeted: isRetweeted,
    isBookmarked: isBookmarked,
    score: Number(row._score ?? score),
    reasons: row._reasons ?? reasons,
    parentTweet: embeddedParent,
  };
}

/* ---------------------------
 * Service Utilities
 * --------------------------- */

async function getTweetInteractionAndMedia(
  tweetIds: string[],
  userId: string
): Promise<InteractionMap> {
  if (tweetIds.length === 0) return new Map();

  const tweetIdPlaceholder = Prisma.join(
    tweetIds.map((id) => Prisma.sql`${id}`),
    ","
  );

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

  const interactionMap: InteractionMap = new Map<string, InteractionData>();
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

export async function fetchEmbeddedParentTweet(
  parentId: string,
  currentUserId: string
) {
  const interactionMap = await getTweetInteractionAndMedia(
    [parentId],
    currentUserId
  );

  const interactions = interactionMap.get(parentId) ?? {
    isLiked: false,
    isRetweeted: false,
    isBookmarked: false,
    mediaIds: [],
  };

  const parentTweet = await prisma.tweet.findUnique({
    where: { id: parentId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          verified: true,
          protectedAccount: true,
          profileMedia: { select: { id: true, keyName: true } },
        },
      },
      tweetMedia: { select: { mediaId: true } },
    },
  });

  if (!parentTweet) return null;

  return {
    ...parentTweet,
    isLiked: interactions.isLiked,
    isRetweeted: interactions.isRetweeted,
    isBookmarked: interactions.isBookmarked,
    mediaIds: parentTweet.tweetMedia.map((tm) => tm.mediaId),
  };
}

export async function fetchFullTweetData(
  candidateRows: any[],
  currentUserId: string
): Promise<any[]> {
  const candidateIds = candidateRows.map((r) => r.id);
  if (candidateIds.length === 0) return [];

  // 1. Fetch Interactions and Media IDs for all candidates
  const interactionMap = await getTweetInteractionAndMedia(
    candidateIds,
    currentUserId
  );

  // 2. Fetch full Tweets + User data for candidates
  const fullTweets = await prisma.tweet.findMany({
    where: { id: { in: candidateIds } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          verified: true,
          protectedAccount: true,
          profileMedia: { select: { id: true, keyName: true } },
        },
      },
    },
  });

  const fullTweetMap = new Map(fullTweets.map((t) => [t.id, t]));

  // 3. Identify and fetch Parent Tweets for QUOTES/REPLIES to be embedded
  const parentIdsToEmbed = new Set<string>();
  for (const c of candidateRows) {
    if (c.parentId && (c.tweetType === "QUOTE" || c.tweetType === "REPLY")) {
      if (!fullTweetMap.has(c.parentId)) {
        parentIdsToEmbed.add(c.parentId);
      }
    }
  }

  const parentTweetMap = new Map<string, any>();
  if (parentIdsToEmbed.size > 0) {
    const parents = await Promise.all(
      Array.from(parentIdsToEmbed).map((id) =>
        fetchEmbeddedParentTweet(id, currentUserId)
      )
    );
    parents
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .forEach((p) => parentTweetMap.set(p.id, p));
  }

  // 4. Merge data and embed the parent tweet
  return candidateRows.map((c) => {
    const fullTweet = fullTweetMap.get(c.id);
    const interactions = interactionMap.get(c.id) ?? {
      isLiked: false,
      isRetweeted: false,
      isBookmarked: false,
      mediaIds: [],
    };

    let embeddedParentData = c.parentId
      ? parentTweetMap.get(c.parentId)
      : undefined;

    if (!embeddedParentData && c.parentId && fullTweetMap.has(c.parentId)) {
      embeddedParentData = fullTweetMap.get(c.parentId);
    }

    return {
      ...c,
      ...fullTweet,
      user: fullTweet?.user,
      isLiked: interactions.isLiked,
      isRetweeted: interactions.isRetweeted,
      isBookmarked: interactions.isBookmarked,
      mediaIds: interactions.mediaIds,
      _embeddedParent: embeddedParentData,
      likesCount: fullTweet?.likesCount ?? c.likesCount,
      retweetCount: fullTweet?.retweetCount ?? c.retweetCount,
      repliesCount: fullTweet?.repliesCount ?? c.repliesCount,
      quotesCount: fullTweet?.quotesCount ?? c.quotesCount,
    };
  });
}

/* ---------------------------
 * TimelineService Class
 * --------------------------- */
export class TimelineService {
  /**
   * getTimeline
   */
  async getTimeline(params: TimelineParams): Promise<TimelineResponse> {
    const limit = params.limit ?? 20;
    const cacheKey = `following:${params.userId}:l${limit}:c${
      params.cursor ?? "none"
    }`;

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
      const empty: TimelineResponse = {
        user: params.userId,
        items: [],
        nextCursor: null,
        generatedAt: new Date().toISOString(),
      };
      await cacheSet(cacheKey, empty, CONFIG.cacheTTL).catch(() => {});
      return empty;
    }

    // 2) negative signals: muted, blocked, notInterested
    const [mutedRows, blockedRows] = await Promise.all([
      prisma.mute.findMany({
        where: { muterId: params.userId },
        select: { mutedId: true },
      }),
      prisma.block.findMany({
        where: { blockerId: params.userId },
        select: { blockedId: true },
      }),
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
    for (const g of spamGroups)
      spamCounts.set(g.tweetId, Number(g._count.tweetId));

    // 4) Candidate generation (raw SQL)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWindow = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const followingPlaceholder = Prisma.join(
      followingIds.map((id) => Prisma.sql`${id}`),
      ","
    );
    const mutedPlaceholder = mutedIds.size
      ? Prisma.join(
          Array.from(mutedIds).map((id) => Prisma.sql`${id}`),
          ","
        )
      : Prisma.sql`'__null__'`;

    const rawCandidates = await prisma.$queryRaw<any[]>`
      WITH
      base_tweets AS (
        SELECT t.id, t."userId", t.content, t."createdAt", t."lastActivityAt", 
               t."likesCount", t."retweetCount", t."repliesCount", t."quotesCount", t."replyControl", t."parentId", t."tweetType",
               u.username,
               u.name,
               u."profileMediaId",
               u.verified,
               u."protectedAccount",
               m."keyName" as "profileMediaKey",
               COALESCE(t."likesCount",0) AS likes,
               COALESCE(t."retweetCount",0) AS rts,
               COALESCE(t."repliesCount",0) AS replies,
               COALESCE(t."quotesCount",0) AS quotes,
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
               ) as tags,
               'from_following' as reason,
               NULL::text as retweeterId,
               NULL::timestamp without time zone as retweetAt, -- Ensure type consistency
               NULL::text as quoteAuthorId
        FROM "tweets" t
        JOIN "users" u on u.id = t."userId"
        LEFT JOIN "medias" m on m.id = u."profileMediaId"
        WHERE t."createdAt" >= ${sevenDaysAgo}
          AND t."userId" IN (${followingPlaceholder})
          AND t."userId" NOT IN (${mutedPlaceholder})
      ),
      retweeted AS (
        SELECT t.id, t."userId", t.content, t."createdAt", t."lastActivityAt", 
               t."likesCount", t."retweetCount", t."repliesCount", t."quotesCount", t."replyControl", t."parentId", t."tweetType",
               'retweet_by_following' as reason, 
               r."userId" as retweeterId, 
               r."createdAt" as retweetAt,
               NULL::text as quoteAuthorId
        FROM "Retweet" r
        JOIN "tweets" t on t.id = r."tweetId"
        WHERE r."userId" IN (${followingPlaceholder})
          AND r."createdAt" >= ${sevenDaysAgo}
      ),
      quotes_by_followings AS (
        SELECT q.id, q."userId", q.content, q."createdAt", q."lastActivityAt", 
               q."likesCount", q."retweetCount", q."repliesCount", q."quotesCount", q."replyControl", q."parentId", q."tweetType",
               'quote_by_following' as reason, 
               NULL::text as retweeterId,
               NULL::timestamp without time zone as retweetAt, -- Ensure type consistency
               q."userId" as quoteAuthorId
        FROM "tweets" q
        WHERE q."userId" IN (${followingPlaceholder})
          AND q."tweetType" = 'QUOTE'
          AND q."createdAt" >= ${sevenDaysAgo}
      ),
      trending_in_followings AS (
        SELECT bt.id, bt."userId", bt.content, bt."createdAt", bt."lastActivityAt", 
               bt."likesCount", bt."retweetCount", bt."repliesCount", bt."quotesCount", bt."replyControl", bt."parentId", bt."tweetType",
               bt.username, bt.name, bt."profileMediaId", bt.verified, bt."protectedAccount", bt."profileMediaKey", 
               bt.likes, bt.rts, bt.replies, bt.quotes, bt.reputation, bt.likes_recent, bt.rts_recent, bt.tags,
               'trending' as reason,
               NULL::text as retweeterId,
               NULL::timestamp without time zone as retweetAt, -- Ensure type consistency
               NULL::text as quoteAuthorId
        FROM base_tweets bt
        ORDER BY ( (bt.likes_recent + bt.rts_recent * 2) * 3 + (bt.likes + bt.rts * 2) ) DESC
        LIMIT 300
      )
      -- Define the final column list order
      SELECT DISTINCT ON (id) 
        id, "userId", content, "createdAt", "lastActivityAt", "likesCount", "retweetCount", "repliesCount", "quotesCount", "replyControl", "parentId", "tweetType", 
        username, name, "profileMediaId", verified, "protectedAccount", "profileMediaKey", 
        likes, rts, replies, quotes, reputation, likes_recent, rts_recent, tags, 
        reason, retweeterId, retweetAt, quoteAuthorId
      FROM (
        -- 1. Base Tweets
        SELECT 
          id, "userId", content, "createdAt", "lastActivityAt", "likesCount", "retweetCount", "repliesCount", "quotesCount", "replyControl", "parentId", "tweetType",
          username, name, "profileMediaId", verified, "protectedAccount", "profileMediaKey", 
          likes, rts, replies, quotes, reputation, likes_recent, rts_recent, tags, 
          reason, retweeterId, retweetAt, quoteAuthorId
        FROM base_tweets 

        UNION ALL

        -- 2. Retweeted Tweets (Need to join to base_tweets to get user/score info)
        SELECT 
          r.id, r."userId", r.content, r."createdAt", r."lastActivityAt", r."likesCount", r."retweetCount", r."repliesCount", r."quotesCount", r."replyControl", r."parentId", r."tweetType",
          bt.username, bt.name, bt."profileMediaId", bt.verified, bt."protectedAccount", bt."profileMediaKey", 
          bt.likes, bt.rts, bt.replies, bt.quotes, bt.reputation, bt.likes_recent, bt.rts_recent, bt.tags,
          r.reason, r.retweeterId, r.retweetAt, r.quoteAuthorId
        FROM retweeted r 
        JOIN base_tweets bt ON r.id = bt.id

        UNION ALL
        
        -- 3. Quotes by Followings (Need to join to base_tweets to get user/score info)
        SELECT 
          q.id, q."userId", q.content, q."createdAt", q."lastActivityAt", q."likesCount", q."retweetCount", q."repliesCount", q."quotesCount", q."replyControl", q."parentId", q."tweetType",
          u.username, u.name, u."profileMediaId", u.verified, u."protectedAccount", m."keyName" as "profileMediaKey", 
          COALESCE(q."likesCount",0) AS likes, COALESCE(q."retweetCount",0) AS rts, COALESCE(q."repliesCount",0) AS replies, COALESCE(q."quotesCount",0) AS quotes,
          u.reputation,
          (SELECT COUNT(*) FROM "TweetLike" tl WHERE tl."tweetId" = q.id AND tl."createdAt" >= ${recentWindow}) as likes_recent,
          (SELECT COUNT(*) FROM "Retweet" rt WHERE rt."tweetId" = q.id AND rt."createdAt" >= ${recentWindow}) as rts_recent,
          (SELECT ARRAY_AGG(h."tag_text") FROM "tweetHashes" th JOIN "hashes" h on h.id = th."hashId" WHERE th."tweetId" = q.id) as tags,
          q.reason, q.retweeterId, q.retweetAt, q.quoteAuthorId
        FROM quotes_by_followings q
        JOIN "users" u on u.id = q."userId"
        LEFT JOIN "medias" m on m.id = u."profileMediaId"

        UNION ALL

        -- 4. Trending in Followings
        SELECT 
          id, "userId", content, "createdAt", "lastActivityAt", "likesCount", "retweetCount", "repliesCount", "quotesCount", "replyControl", "parentId", "tweetType",
          username, name, "profileMediaId", verified, "protectedAccount", "profileMediaKey", 
          likes, rts, replies, quotes, reputation, likes_recent, rts_recent, tags, 
          reason, retweeterId, retweetAt, quoteAuthorId
        FROM trending_in_followings
      ) pool
      ORDER BY id, (likes + rts*2) DESC
      LIMIT ${CONFIG.candidateLimit_F}
    `;

    if (!rawCandidates || rawCandidates.length === 0) {
      // ... (rest of the file remains the same)
      const empty: TimelineResponse = {
        user: params.userId,
        items: [],
        nextCursor: null,
        generatedAt: new Date().toISOString(),
      };
      try {
        await cacheSet(cacheKey, empty, CONFIG.cacheTTL);
      } catch {}
      return empty;
    }

    // 5) Filter explicit negatives
    const filteredCandidates = rawCandidates.filter((c) => {
      if (blockedIds.has(c.userId)) return false;
      if (notInterestedSet.has(c.id)) return false;
      if (c.reason === "retweet_by_following" && blockedIds.has(c.retweeterid))
        return false;
      if (c.reason === "quote_by_following" && blockedIds.has(c.quoteauthorid))
        return false;
      return true;
    });

    // 6) Score candidates
    const scored = filteredCandidates.map((r: any) => {
      const createdAt = new Date(r.createdAt ?? r.created_at ?? new Date());

      const base = baseEngagementScore_F({
        likes: Number(r.likes ?? 0),
        rts: Number(r.rts ?? 0),
        replies: Number(r.replies ?? 0),
        quotes: Number(r.quotes ?? 0),
      });

      const recentEng =
        Number(r.likes_recent ?? 0) + 2 * Number(r.rts_recent ?? 0);
      const velocityMultiplier =
        1 + Math.log1p(recentEng) * CONFIG.velocityBoostFactor;

      let score = (base + 1) * velocityMultiplier;

      // recency
      score *= recencyScore(createdAt, CONFIG.recencyHalfLifeHours_F);

      // boosts
      if (String(r.reason)?.includes("retweet_by_following"))
        score *= CONFIG.retweetByFollowingBoost;
      if (String(r.reason)?.includes("quote_by_following"))
        score *= CONFIG.quoteByFollowingBoost;

      // verified
      if (r.verified === true || r.verified === 1)
        score *= CONFIG.verifiedBoost_F;

      // author reputation
      let authorReputation = Number(r.reputation ?? 1.0);
      authorReputation = Math.max(
        CONFIG.authorReputationFloor_F,
        Math.min(CONFIG.authorReputationCap, authorReputation)
      );
      score *= authorReputation;

      // spam penalty
      const spamCount = spamCounts.get(r.id) ?? 0;
      if (spamCount > 0)
        score /= 1 + spamCount * CONFIG.spamReportPenaltyPerReport;

      // small noise
      score = score * (1 + gaussianNoise());

      const reasons = [String(r.reason ?? "from_following")];
      return { row: r, score, reasons };
    });

    // 7) Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // 8) Diversity & author capping + thread expansion:
    const scoredCandidatesWithBaseInfo: any[] = scored.map((s) => ({
      ...s.row,
      _score: s.score,
      _reasons: s.reasons,
    }));

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

    // Fetch full tweet data and embed parents for replies/quotes
    let results = await fetchFullTweetData(diversifiedResults, params.userId);

    // Optional: expand threads (for replies whose parent was not a primary candidate)
    if (params.includeThreads) {
      const parentIds = new Set<string>();
      for (const res of results) {
        if (
          res.parentId &&
          !results.some((r) => r.id === res.parentId) &&
          res._embeddedParent === undefined
        )
          parentIds.add(res.parentId);
      }

      const parentsToPrepend = Array.from(parentIds);

      if (parentsToPrepend.length > 0) {
        const parentList = parentsToPrepend.slice(0, 200);

        const parents = await prisma.tweet.findMany({
          where: { id: { in: parentList } },
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
            tweetMedia: { select: { mediaId: true } },
            tweetLikes: {
              where: { userId: params.userId },
              select: { userId: true },
            },
            retweets: {
              where: { userId: params.userId },
              select: { userId: true },
            },
            tweetBookmark: {
              where: { userId: params.userId },
              select: { userId: true },
            },
          },
        });

        for (const p of parents) {
          const authorCount = seenAuthors.get(p.userId) ?? 0;
          if (authorCount >= CONFIG.diversityAuthorLimit) continue;

          const parentItem = {
            ...p,
            _score: Number.MAX_SAFE_INTEGER / 10,
            _reasons: ["thread_parent"],
            likesCount: p.likesCount,
            retweetCount: p.retweetCount,
            quotesCount: p.quotesCount,
            repliesCount: p.repliesCount,
            isLiked: p.tweetLikes.length > 0,
            isRetweeted: p.retweets.length > 0,
            isBookmarked: p.tweetBookmark.length > 0,
            mediaIds: p.tweetMedia.map((tm) => tm.mediaId),
            _embeddedParent: undefined,
          };

          results.unshift(parentItem);
          seenAuthors.set(p.userId, authorCount + 1);
        }
      }
    }

    // 9) Final sort & pagination
    results.sort((a, b) => {
      const sa = Number(a._score ?? 0);
      const sb = Number(b._score ?? 0);
      if (sb !== sa) return sb - sa;
      return (
        new Date(b.createdAt ?? b.created_at).getTime() -
        new Date(a.createdAt ?? a.created_at).getTime()
      );
    });

    let startIndex = 0;
    if (params.cursor) {
      const idx = results.findIndex((r) => r.id === params.cursor);
      if (idx >= 0) startIndex = idx + 1;
    }
    const pageSlice = results.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < results.length
        ? results[startIndex + limit].id
        : null;

    const items = pageSlice.map((r) =>
      mapToDTO(
        r,
        Number(r._score ?? 0),
        r._reasons ?? [String(r.reason ?? "")],
        r._embeddedParent
      )
    );

    const response: TimelineResponse = {
      user: params.userId,
      items,
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // 10) Cache briefly
    try {
      await cacheSet(cacheKey, response, CONFIG.cacheTTL);
    } catch {}

    return response;
  }

  /**
   * getForYou
   */
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
    const [mutedRows, blockedRows] = await Promise.all([
      prisma.mute.findMany({
        where: { muterId: params.userId },
        select: { mutedId: true },
      }),
      prisma.block.findMany({
        where: { blockerId: params.userId },
        select: { blockedId: true },
      }),
    ]);
    const mutedIds = mutedRows.map((r) => r.mutedId);
    const blockedIds = blockedRows.map((r) => r.blockedId);

    let notInterestedTweetIds: string[] = [];
    try {
      const ni = await (prisma as any).notInterested.findMany({
        where: { userId: params.userId },
        select: { tweetId: true },
      });
      interface NotInterestedRow {
        tweetId: string;
      }
      notInterestedTweetIds = (ni as NotInterestedRow[]).map((r) => r.tweetId);
    } catch {
      notInterestedTweetIds = [];
    }

    // 5) Author reputation (graceful) - FIX: Explicitly defined Map type
    let authorReputation: Map<string, number> = new Map<string, number>();
    try {
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

    // 6) Top user topics (hashtags)
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
          u."protectedAccount",
          u.reputation,
          m."keyName" as "profileMediaKey",
          COALESCE(t."likesCount",0) as likes,
          COALESCE(t."retweetCount",0) as rts,
          COALESCE(t."repliesCount",0) as replies,
          t."replyControl",
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
        JOIN "tweetbookmarks" tb on tb."tweetId" = b.id
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

    // 8) Filter out explicit user negatives
    const filtered = [];
    const notInterestedSet = new Set(notInterestedTweetIds);
    let spamCounts = new Map<string, number>();
    try {
      const reports = (prisma as any).spamReport?.groupBy
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

    // 9) Scoring:
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
      const rep =
        repFromMap === 1.0 && r.reputation ? Number(r.reputation) : repFromMap;

      score *= Math.max(
        CONFIG.authorReputationFloor_FY,
        Math.min(CONFIG.authorReputationCap, rep)
      );

      // spam penalty
      const spamCount = spamCounts.get(r.id) ?? 0;
      if (spamCount > 0) score /= 1 + spamCount * 0.5;

      // small random noise
      score = score * (1 + gaussianNoise());

      return { row: r, score, reasons: [String(r.reason ?? "")] };
    });

    // 10) sort desc by score
    scored.sort((a, b) => b.score - a.score);

    // 11) diversity & author caps
    const scoredCandidatesWithBaseInfo: any[] = scored.map((s) => ({
      ...s.row,
      _score: s.score,
      _reasons: s.reasons,
    }));

    const seenAuthors = new Map<string, number>();
    const diversifiedResults: any[] = [];

    for (const s of scoredCandidatesWithBaseInfo) {
      const auth = s.userId;
      const current = seenAuthors.get(auth) ?? 0;
      if (current >= CONFIG.diversityAuthorLimit) continue;

      const repFromMap = authorReputation.get(auth) ?? 1.0;
      const rep =
        repFromMap === 1.0 && s.reputation ? Number(s.reputation) : repFromMap;

      if (rep < CONFIG.authorReputationFloor_FY) continue;

      seenAuthors.set(auth, current + 1);
      diversifiedResults.push(s);
      if (diversifiedResults.length >= limit * 3) break;
    }

    // Fetch full tweet data and embed parents for replies/quotes
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

    const items = page.map((r) =>
      mapToDTO(
        r,
        Number(r._score ?? 0),
        r._reasons ?? [String(r.reason ?? "")],
        r._embeddedParent
      )
    );

    const response: ForYouResponseDTO = {
      user: params.userId,
      recommendations: items,
      items,
      nextCursor,
      generatedAt: new Date().toISOString(),
    };

    // Cache for a short time
    await cacheSet(cacheKey, response, CONFIG.cacheTTL);

    return response;
  }
}
