// src/background/workers/searchIndexer.ts
import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { loadSecrets, getSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";

import { Crawler } from "../../api/controllers/SearchEngine";
import { Parser } from "../../api/controllers/SearchEngine";
import { Indexer } from "../../api/controllers/SearchEngine";
import { PersistenceManager } from "../../api/controllers/SearchEngine";
import { Logger } from "../../api/controllers/SearchEngine";
// src/background/workers/searchIndexer.ts
import prisma from "../../database"
const logger = new Logger("SearchIndexer");

interface SearchIndexJobData {
  type: "full" | "incremental";
  limit?: number;
}

async function startWorker() {
  await initRedis();
  await loadSecrets();

  logger.info("🚀 Starting search indexer worker...");

  const { REDIS_URL } = getSecrets();
  

 
  

  logger.info("✅ Database connected");

  // Initialize search components
  const crawler = new Crawler(prisma);
  const parser = new Parser();
  const indexer = new Indexer();
  const persistence = new PersistenceManager(REDIS_URL);

  logger.info("✅ Search components initialized");

  // Load existing index from Redis
  const loaded = await persistence.loadIndex("search_index");
  if (loaded) {
    logger.info("✅ Loaded existing index from Redis");
  } else {
    logger.warn("⚠ No existing index found in Redis");
  }

  const searchIndexerWorker = new Worker<SearchIndexJobData>(
    "search-indexer",
    async (job) => {
      logger.info(`📊 Processing ${job.data.type} indexing job: ${job.id}`);

      try {
        if (job.data.type === "full") {
          // FULL CRAWL
          logger.info("Starting full crawl...");

          const tweets = await crawler.crawlTweets(1000, 0);
          const users = await crawler.crawlUsers(1000, 0);
          const hashtags = await crawler.crawlHashtags(1000, 0);

          const parsedTweets = tweets.map((t) => parser.parseTweet(t));
          const parsedUsers = users.map((u) => parser.parseUser(u));
          const parsedHashtags = hashtags.map((h) => parser.parseHashtag(h));

          indexer.indexMultiple([
            ...parsedTweets,
            ...parsedUsers,
            ...parsedHashtags,
          ]);

          await persistence.saveIndex(indexer.getIndexStats(), "search_index");

          logger.info(
            `✅ Full index created: ${parsedTweets.length} tweets, ${parsedUsers.length} users, ${parsedHashtags.length} hashtags`
          );

          return {
            success: true,
            type: "full",
            tweets: parsedTweets.length,
            users: parsedUsers.length,
            hashtags: parsedHashtags.length,
          };
        } else {
          // INCREMENTAL UPDATE
          logger.info("Starting incremental update...");

          const stats = indexer.getIndexStats();
          const limit = job.data.limit || 200;

          // Fetch new data
          const newTweets = await crawler.crawlTweets(limit, stats.tweets);
          const newUsers = await crawler.crawlUsers(limit, stats.users);
          const newHashtags = await crawler.crawlHashtags(limit, stats.hashtags);

          // Parse and index
          const parsedTweets = newTweets.map((t) => parser.parseTweet(t));
          const parsedUsers = newUsers.map((u) => parser.parseUser(u));
          const parsedHashtags = newHashtags.map((h) => parser.parseHashtag(h));

          indexer.indexMultiple([
            ...parsedTweets,
            ...parsedUsers,
            ...parsedHashtags,
          ]);

          // Save to Redis
          await persistence.saveIndex(indexer.getIndexStats(), "search_index");

          logger.info(
            `✅ Incremental update: +${parsedTweets.length} tweets, +${parsedUsers.length} users, +${parsedHashtags.length} hashtags`
          );

          return {
            success: true,
            type: "incremental",
            tweets: parsedTweets.length,
            users: parsedUsers.length,
            hashtags: parsedHashtags.length,
          };
        }
      } catch (error) {
        logger.error(`❌ Indexing job failed:`, error);
        throw error;
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: 1, // Only run one indexing job at a time
    }
  );

  searchIndexerWorker.on("completed", (job) => {
    logger.info(
      `✅ [search-indexer.worker] Job completed: ${job.id} (${job.data.type})`
    );
  });

  searchIndexerWorker.on("failed", (job, err) => {
    logger.error(`❌ [search-indexer.worker] Job failed: ${job?.id}`, err);
  });

  searchIndexerWorker.on("error", (err) => {
    logger.error("❌ [search-indexer.worker] Worker error:", err);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, disconnecting Prisma...");
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, disconnecting Prisma...");
    await prisma.$disconnect();
    process.exit(0);
  });

  logger.info("✅ Search indexer worker started successfully");
}

startWorker().catch((err) => {
  logger.error("❌ [search-indexer.worker] Failed to start:", err);
  process.exit(1);
});