// src/routes/search.routes.ts
import { Router, Request, Response } from "express";
import { Crawler } from "@/api/search/crawler";
import { Parser } from "@/api/search/parser";
import { Indexer } from "@/api/search/indexer";
import { SearchEngine } from "@/api/search/searchEngine";
import { PersistenceManager } from "@/api/search/persistence";

export function twitterSearchRoutes(
  crawler: Crawler,
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine,
  persistence: PersistenceManager
) {
  const router = Router();

  /**
   * GET /api/search/top
   * Returns top 3 users and top 3 tweets (like Twitter's top tab)
   */
  router.get("/search/top", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'q' is required",
        });
      }

      const limit = parseInt(req.query.limit as string) || 6;
      const results = searchEngine.searchTop(q, limit);

      return res.status(200).json({
        success: true,
        data: {
          users: results.users.map(formatUser),
          tweets: results.tweets.map(formatTweet),
        },
        query: q,
      });
    } catch (error) {
      console.error("Search top error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/search/people
   * Returns only users matching the query
   */
  router.get("/search/people", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'q' is required",
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const results = searchEngine.searchPeople(q, limit);

      return res.status(200).json({
        success: true,
        data: results.data.map(formatUser),
        total: results.total,
        query: q,
      });
    } catch (error) {
      console.error("Search people error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/search/latest
   * Returns tweets sorted by creation date (most recent first)
   */
  router.get("/search/latest", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'q' is required",
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const results = searchEngine.searchLatest(q, limit);

      return res.status(200).json({
        success: true,
        data: results.data.map(formatTweet),
        total: results.total,
        query: q,
      });
    } catch (error) {
      console.error("Search latest error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/search/media
   * Returns only tweets that contain photos or videos
   */
  router.get("/search/media", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'q' is required",
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const results = searchEngine.searchMedia(q, limit);

      return res.status(200).json({
        success: true,
        data: results.data.map(formatTweet),
        total: results.total,
        query: q,
      });
    } catch (error) {
      console.error("Search media error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/search/document?id=xxx&type=tweet
   * Returns the raw indexed document for inspection
   * ✅ FIXED: Now properly reads 'id' from query params
   */
  router.get("/search/document", async (req: Request, res: Response) => {
    try {
      const { id, type } = req.query; // ✅ FIXED: Get id from query, not from user auth

      if (!id || typeof id !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'id' is required",
        });
      }

      if (type === "tweet") {
        const tweet = indexer.getTweet(id);
        if (!tweet) {
          return res.status(404).json({
            success: false,
            message: "Tweet not found in index",
          });
        }

        return res.status(200).json({
          success: true,
          data: {
            ...tweet,
            type: "tweet",
          },
        });
      } else if (type === "user") {
        const user = indexer.getUser(id);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found in index",
          });
        }

        return res.status(200).json({
          success: true,
          data: {
            ...user,
            type: "user",
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'type' must be 'tweet' or 'user'",
        });
      }
    } catch (error) {
      console.error("Get document error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/search/stats
   * Returns index statistics
   */
  router.get("/search/stats", async (req: Request, res: Response) => {
    try {
      const stats = searchEngine.getStats();
      const metadata = await persistence.getIndexMetadata("search_index");

      return res.status(200).json({
        success: true,
        data: {
          ...stats,
          metadata,
        },
      });
    } catch (error) {
      console.error("Get stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * POST /api/search/reindex
   * Manually trigger a full reindex (admin only)
   */
  router.post("/search/reindex", async (req: Request, res: Response) => {
    try {
      // Start reindexing in background
      reindexInBackground(crawler, parser, indexer, searchEngine, persistence);

      return res.status(202).json({
        success: true,
        message: "Reindexing started in background",
      });
    } catch (error) {
      console.error("Reindex error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  return router;
}

/**
 * Helper: Reindex in background
 */
async function reindexInBackground(
  crawler: Crawler,
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine,
  persistence: PersistenceManager
) {
  console.log("🔄 Starting full reindex...");
  const startTime = Date.now();

  try {
    indexer.clear();

    // Index tweets in batches
    let tweetCount = 0;
    for await (const batch of crawler.crawlTweetsInBatches(1000)) {
      const parsed = batch.map((t) => parser.parseTweet(t));
      indexer.indexTweets(parsed);
      tweetCount += batch.length;
      console.log(`Indexed ${tweetCount} tweets...`);
    }

    // Index users in batches
    let userCount = 0;
    for await (const batch of crawler.crawlUsersInBatches(1000)) {
      const parsed = batch.map((u) => parser.parseUser(u));
      indexer.indexUsers(parsed);
      userCount += batch.length;
      console.log(`Indexed ${userCount} users...`);
    }

    // Save to Redis
    await searchEngine.saveIndex("search_index");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Reindex complete in ${duration}s: ${tweetCount} tweets, ${userCount} users`);
  } catch (error) {
    console.error("❌ Reindex failed:", error);
  }
}

/**
 * Format user for API response
 */
function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    verified: user.verified,
    profileMediaId: user.profileMediaId,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    score: user.score,
  };
}

/**
 * Format tweet for API response
 */
function formatTweet(tweet: any) {
  return {
    id: tweet.id,
    content: tweet.content,
    createdAt: tweet.createdAt,
    likesCount: tweet.likesCount,
    retweetCount: tweet.retweetCount,
    repliesCount: tweet.repliesCount,
    quotesCount: tweet.quotesCount,
    user: {
      id: tweet.userId,
      name: tweet.name,
      username: tweet.username,
      verified: tweet.verified,
      profileMediaId: tweet.profileMediaId,
    },
    mediaIds: tweet.mediaIds,
    hashtags: tweet.hashtags,
    mentions: tweet.mentions,
    score: tweet.score,
  };
}