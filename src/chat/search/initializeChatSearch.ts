// src/chat/search/initializeChatSearch.ts
import { ChatCrawler } from "./chatCrawler";
import { ChatParser } from "./chatParser";
import { ChatIndexer } from "./chatIndexer";
import { ChatSearchEngine } from "./chatSearchEngine";
import { ChatPersistenceManager } from "./chatPersistence"; // Reuse from tweet search
import { prisma } from "@/prisma/client";
import { getSecrets } from "@/config/secrets";
import {
  initializeChatJobSystem,
  scheduleChatIncrementalUpdates,
} from "../../background/jobs/chatSearchJobs";

class ChatLogger {
  constructor(private context: string) {}

  info(message: string) {
    console.log(`[${this.context}] ℹ️  ${message}`);
  }

  warn(message: string) {
    console.log(`[${this.context}] ⚠️  ${message}`);
  }

  error(message: string, error?: any) {
    console.error(`[${this.context}] ❌ ${message}`, error || "");
  }
}

export async function initializeChatSearchEngine(
  redisUrl?: string,
  userId?: string // Optional: load index for specific user
) {
  const logger = new ChatLogger("ChatSearchInit");

  try {
    const { REDIS_URL } = getSecrets();

    // ============================================
    // 1) INITIALIZE COMPONENTS
    // ============================================
    logger.info("Creating chat search engine components...");

    const chatCrawler = new ChatCrawler(prisma);
    const chatParser = new ChatParser();
    const chatIndexer = new ChatIndexer();
    const chatPersistence = new ChatPersistenceManager(redisUrl || REDIS_URL);
    const chatSearchEngine = new ChatSearchEngine(
      chatIndexer,
      chatParser,
      chatPersistence
    );

    // ✅ Initialize the job system with components
    initializeChatJobSystem({
      chatCrawler,
      chatParser,
      chatIndexer,
      chatSearchEngine,
      chatPersistence,
    });

    // ============================================
    // 2) LOAD INDEX FROM REDIS IF EXISTS (User-specific)
    // ============================================
    if (userId) {
      logger.info(`Loading chat index for user ${userId} from Redis...`);

      const loaded = await chatSearchEngine.loadIndex(
        `chat_search_index:${userId}`
      );

      if (loaded) {
        logger.info(`✔ Loaded chat index for user ${userId} from Redis`);

        const metadata = await chatPersistence.getChatIndexMetadata(
          `chat_search_index:${userId}`
        );
        if (metadata) {
          logger.info(`Index last updated: ${metadata.lastUpdated}`);
          logger.info(`Stats: ${JSON.stringify(metadata.stats)}`);
        }

        const stats = chatSearchEngine.getStats();
        logger.info(`Current index: ${stats.totalUsers} users`);
      } else {
        logger.warn(`⚠ No chat index found for user ${userId}`);
        logger.info("Chat index will be built on first search request");
      }
    } else {
      logger.info("No user ID provided - skipping index load");
      logger.info("Indexes will be loaded per-user on demand");
    }

    // ============================================
    // 3) SCHEDULE INCREMENTAL UPDATES
    // ============================================
    logger.info("Scheduling chat incremental updates...");
    await scheduleChatIncrementalUpdates();
    logger.info("✔ Chat incremental updates scheduled (every 60 seconds)");

    logger.info("Chat search engine initialized successfully");

    return {
      chatCrawler,
      chatParser,
      chatIndexer,
      chatSearchEngine,
      chatPersistence,
    };
  } catch (error) {
    logger.error("Failed to initialize chat search engine", error);
    throw error;
  }
}

/**
 * Setup chat search API routes
 * Call this from your main app file
 */
export async function setupChatSearchAPI(app: any) {
  try {
    console.log("🔧 Setting up chat search API...");

    // Initialize chat search engine (without user-specific index)
    const components = await initializeChatSearchEngine();

    // Import and register routes
    const { chatSearchRoutes } = await import("../../api/routes/chatSearch.routes");

    app.use(
      "/api",
      chatSearchRoutes(
        components.chatCrawler,
        components.chatParser,
        components.chatIndexer,
        components.chatSearchEngine,
        components.chatPersistence
      )
    );

    console.log("✅ Chat search API routes registered at /api/chat/*");
    console.log("   - GET /api/chat/search?q=john&filter=all&cursor=xxx");
    console.log("   - GET /api/chat/suggestions?limit=10");
    console.log("   - GET /api/chat/recent?limit=20");
    console.log("   - GET /api/chat/user/:id");
    console.log("   - GET /api/chat/search/stats");
    console.log("   - POST /api/chat/search/reindex");
    console.log("   - PUT /api/chat/online-status");

    return components;
  } catch (error) {
    console.error("❌ Failed to setup chat search API:", error);
    throw error;
  }
}

/**
 * Load or build chat index for a specific user
 * Call this when user logs in or makes their first chat search
 */
export async function ensureChatIndexForUser(
  userId: string,
  components: {
    chatCrawler: ChatCrawler;
    chatParser: ChatParser;
    chatIndexer: ChatIndexer;
    chatSearchEngine: ChatSearchEngine;
    chatPersistence: ChatPersistenceManager;
  }
): Promise<void> {
  const logger = new ChatLogger("ChatIndexEnsure");

  try {
    // Try to load existing index
    const loaded = await components.chatSearchEngine.loadIndex(
      `chat_search_index:${userId}`
    );

    if (loaded) {
      logger.info(`✔ Loaded existing chat index for user ${userId}`);
      return;
    }

    // Index doesn't exist - build it
    logger.info(`Building new chat index for user ${userId}...`);
    const startTime = Date.now();

    components.chatIndexer.clear();

    let userCount = 0;
    for await (const batch of components.chatCrawler.crawlChatUsersInBatches(
      userId,
      1000
    )) {
      const parsed = batch.map((u) => components.chatParser.parseChatUser(u));
      components.chatIndexer.indexChatUsers(parsed);
      userCount += batch.length;
    }

    await components.chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Built chat index for user ${userId} in ${duration}s (${userCount} users)`
    );
  } catch (error) {
    logger.error(`Failed to ensure chat index for user ${userId}`, error);
    throw error;
  }
}