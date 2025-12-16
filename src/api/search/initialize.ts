// src/search/initialize.ts
import { Crawler } from "./crawler";
import { Parser } from "./parser";
import { Indexer } from "./indexer";
import { SearchEngine } from "./searchEngine";
import { PersistenceManager } from "./persistence";
import { prisma } from "@/prisma/client";
import { getSecrets } from "@/config/secrets";
import { 
  initializeJobSystem, 
  enqueueFullIndex, 
  scheduleIncrementalUpdates 
} from "@/background/jobs/searchJobs";

class Logger {
  constructor(private context: string) {}

  info(message: string) {
    console.log(`[${this.context}]   ${message}`); //  FIXED: Template literal syntax
  }

  warn(message: string) {
    console.log(`[${this.context}]   ${message}`); //  FIXED
  }

  error(message: string, error?: any) {
    console.error(`[${this.context}]  ${message}`, error || ""); //  FIXED
  }
}

export async function initializeSearchEngine(redisUrl?: string) {
  const logger = new Logger("SearchInit");

  try {
    const { REDIS_URL } = getSecrets();

    // ============================================
    // 1) INITIALIZE COMPONENTS
    // ============================================
    logger.info("Creating search engine components...");
    
    const crawler = new Crawler(prisma);
    const parser = new Parser();
    const indexer = new Indexer();
    const persistence = new PersistenceManager(redisUrl || REDIS_URL);
    const searchEngine = new SearchEngine(indexer, parser, persistence);

    //  Initialize the job system with components
    initializeJobSystem({ crawler, parser, indexer, searchEngine, persistence });

    // ============================================
    // 2) LOAD INDEX FROM REDIS IF EXISTS
    // ============================================
    logger.info("Loading index from Redis...");
    
    const loaded = await searchEngine.loadIndex("search_index");
    
    if (loaded) {
      logger.info("✔ Loaded index from Redis");
      
      const metadata = await persistence.getIndexMetadata("search_index");
      if (metadata) {
        logger.info(`Index last updated: ${metadata.lastUpdated}`); //  FIXED
        logger.info(`Stats: ${JSON.stringify(metadata.stats)}`); //  FIXED
      }

      const stats = searchEngine.getStats();
      logger.info(`Current index: ${stats.totalTweets} tweets, ${stats.totalUsers} users`); //  FIXED
      
    } else {
      logger.warn("⚠ No index found in Redis");
      logger.info("Scheduling full crawl as background job...");
      
      // Schedule full crawl as a background job (non-blocking)
      await enqueueFullIndex();
    }

    // ============================================
    // 3) SCHEDULE INCREMENTAL UPDATES
    // ============================================
    logger.info("Scheduling incremental updates...");
    await scheduleIncrementalUpdates();
    logger.info("✔ Incremental updates scheduled (every 30 seconds)");

    logger.info("Search engine initialized successfully");

    return {
      crawler,
      parser,
      indexer,
      searchEngine,
      persistence,
    };
    
  } catch (error) {
    logger.error("Failed to initialize search engine", error);
    throw error;
  }
}

/**
 * Setup search API routes
 * Call this from your main app file
 */
export async function setupSearchAPI(app: any) {
  try {
    console.log(" Setting up search API...");
    
    // Initialize search engine
    const components = await initializeSearchEngine();

    // Import and register routes
    const { twitterSearchRoutes } = await import("../routes/search.routes");
    
    app.use(
      "/api",
      twitterSearchRoutes(
        components.crawler,
        components.parser,
        components.indexer,
        components.searchEngine,
        components.persistence
      )
    );

    
    return components;
    
  } catch (error) {
    console.error(" Failed to setup search API:", error);
    throw error;
  }
}