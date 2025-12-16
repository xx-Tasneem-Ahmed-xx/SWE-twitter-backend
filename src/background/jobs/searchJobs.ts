// src/background/jobs/searchJobs.ts
import { Crawler } from "@/api/search/crawler";
import { Parser } from "@/api/search/parser";
import { Indexer } from "@/api/search/indexer";
import { SearchEngine } from "@/api/search/searchEngine";
import { PersistenceManager } from "@/api/search/persistence";

let crawler: Crawler;
let parser: Parser;
let indexer: Indexer;
let searchEngine: SearchEngine;
let persistence: PersistenceManager;

let incrementalInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the job system with search components
 */
export function initializeJobSystem(components: {
  crawler: Crawler;
  parser: Parser;
  indexer: Indexer;
  searchEngine: SearchEngine;
  persistence: PersistenceManager;
}) {
  crawler = components.crawler;
  parser = components.parser;
  indexer = components.indexer;
  searchEngine = components.searchEngine;
  persistence = components.persistence;
}

/**
 * Enqueue a full index job (runs in background)
 */
export async function enqueueFullIndex(): Promise<void> {
  console.log("📋 Enqueueing full index job...");
  
  // Run in background without blocking
  setImmediate(async () => {
    await performFullIndex();
  });
}

/**
 * Perform a full index of all tweets and users
 */
async function performFullIndex(): Promise<void> {
  console.log("🔄 Starting full index...");
  const startTime = Date.now();

  try {
    // Clear existing index
    indexer.clear();
    console.log("🧹 Cleared existing index");

    // Index tweets in batches
    let tweetCount = 0;
    console.log("📝 Indexing tweets...");
    
    for await (const batch of crawler.crawlTweetsInBatches(1000)) {
      const parsed = batch.map((t) => parser.parseTweet(t));
      indexer.indexTweets(parsed);
      tweetCount += batch.length;
      
      if (tweetCount % 5000 === 0) {
        console.log(`  ⏳ Indexed ${tweetCount} tweets...`);
      }
    }

    // Index users in batches
    let userCount = 0;
    console.log("👥 Indexing users...");
    
    for await (const batch of crawler.crawlUsersInBatches(1000)) {
      const parsed = batch.map((u) => parser.parseUser(u));
      indexer.indexUsers(parsed);
      userCount += batch.length;
      
      if (userCount % 5000 === 0) {
        console.log(`  ⏳ Indexed ${userCount} users...`);
      }
    }

    // Save to Redis
    console.log("💾 Saving index to Redis...");
    await searchEngine.saveIndex("search_index");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Full index complete in ${duration}s`);
    console.log(`   📊 Tweets: ${tweetCount}, Users: ${userCount}`);
    
    const stats = searchEngine.getStats();
    console.log(`   📈 Stats:`, stats);

  } catch (error) {
    console.error("❌ Full index failed:", error);
    throw error;
  }
}

/**
 * Schedule incremental updates to run every 30 seconds
 */
export async function scheduleIncrementalUpdates(): Promise<void> {
  // Clear any existing interval
  if (incrementalInterval) {
    clearInterval(incrementalInterval);
  }

  console.log("⏰ Scheduling incremental updates (every 30 seconds)...");

  // Run immediately
  await performIncrementalUpdate();

  // Then schedule recurring updates
  incrementalInterval = setInterval(async () => {
    await performIncrementalUpdate();
  }, 30000); // 30 seconds
}

/**
 * Perform an incremental update (fetch recent tweets only)
 */
async function performIncrementalUpdate(): Promise<void> {
  try {
    const startTime = Date.now();

    // Fetch recent tweets (last 200)
    const recentTweets = await crawler.crawlRecentTweets(200);

    if (recentTweets.length === 0) {
      console.log("⚡ No new tweets to index");
      return;
    }

    // Parse and index
    const parsed = recentTweets.map((t) => parser.parseTweet(t));
    indexer.indexTweets(parsed);

    // Save to Redis
    await searchEngine.saveIndex("search_index");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⚡ Incremental update complete in ${duration}s (${recentTweets.length} tweets)`);

  } catch (error) {
    console.error("❌ Incremental update failed:", error);
    // Don't throw - let it retry on next interval
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopJobs(): void {
  if (incrementalInterval) {
    clearInterval(incrementalInterval);
    incrementalInterval = null;
    console.log("🛑 Stopped incremental updates");
  }
}

/**
 * Check if jobs are running
 */
export function isJobsRunning(): boolean {
  return incrementalInterval !== null;
}