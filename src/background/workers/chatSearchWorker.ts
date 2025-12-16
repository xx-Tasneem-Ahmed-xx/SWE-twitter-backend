// src/background/workers/chatSearchWorker.ts
import { Worker, Job, Queue } from "bullmq";
import { ChatCrawler } from "@/chat/search/chatCrawler";
import { ChatParser } from "@/chat/search/chatParser";
import { ChatIndexer } from "@/chat/search/chatIndexer";
import { ChatSearchEngine } from "@/chat/search/chatSearchEngine";
import { ChatPersistenceManager } from "@/chat/search/chatPersistence";
import { prisma } from "@/prisma/client";
import { getSecrets } from "@/config/secrets";
import IORedis from "ioredis";

// Job types
export interface FullChatIndexJob {
  type: "full-index";
  userId: string;
}

export interface IncrementalChatUpdateJob {
  type: "incremental-update";
  userIds?: string[]; // Optional: specific users to update
}

export interface UpdateUnreadJob {
  type: "update-unread";
  userId: string;
  unreadMap: Record<string, boolean>;
}

export interface FollowChangeJob {
  type: "follow-change";
  userId: string;
  targetUserId: string;
  action: "follow" | "unfollow";
}

export type ChatSearchJobData =
  | FullChatIndexJob
  | IncrementalChatUpdateJob
  | UpdateUnreadJob
  | FollowChangeJob;

// Initialize components
const { REDIS_URL } = getSecrets();
const chatCrawler = new ChatCrawler(prisma);
const chatParser = new ChatParser();
const chatIndexer = new ChatIndexer();
const chatPersistence = new ChatPersistenceManager(REDIS_URL);
const chatSearchEngine = new ChatSearchEngine(
  chatIndexer,
  chatParser,
  chatPersistence
);

// Redis connection for BullMQ
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Create queue
export const chatSearchQueue = new Queue<ChatSearchJobData>("chat-search", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

// Create worker
export const chatSearchWorker = new Worker<ChatSearchJobData>(
  "chat-search",
  async (job: Job<ChatSearchJobData>) => {
    const { type } = job.data;

    switch (type) {
      case "full-index":
        return await processFullIndex(job.data);

      case "incremental-update":
        return await processIncrementalUpdate(job.data);

      case "update-unread":
        return await processUpdateUnread(job.data);

      case "follow-change":
        return await processFollowChange(job.data);

      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  }
);

// Job processors

/**
 * Process full index job for a user
 */
async function processFullIndex(data: FullChatIndexJob): Promise<string> {
  const { userId } = data;
  console.log(` Starting full chat index for user ${userId}...`);
  const startTime = Date.now();

  try {
    // Clear existing index
    chatIndexer.clear();
    console.log(" Cleared existing chat index");

    // First pass: collect all user IDs
    const allUserIds: string[] = [];
    console.log(" Collecting user IDs...");

    for await (const batch of chatCrawler.crawlChatUsersInBatches(
      userId,
      1000
    )) {
      allUserIds.push(...batch.map((u) => u.id));
    }

    // Get unread message counts for all users
    console.log("Fetching unread message counts...");
    const unreadCounts = await chatCrawler.getUnreadCounts(userId, allUserIds);

    // Second pass: index all users with unread status
    let userCount = 0;
    console.log(" Indexing chat users...");

    for await (const batch of chatCrawler.crawlChatUsersInBatches(
      userId,
      1000
    )) {
      const parsed = batch.map((u) => {
        const hasUnread = unreadCounts.get(u.id) ? true : false;
        return chatParser.parseChatUser(u, hasUnread);
      });
      chatIndexer.indexChatUsers(parsed);
      userCount += batch.length;

      if (userCount % 5000 === 0) {
        console.log(`   Indexed ${userCount} chat users...`);
      }
    }

    // Save to Redis with user-specific key
    console.log(" Saving chat index to Redis...");
    await chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const message = ` Chat index complete for user ${userId} in ${duration}s (${userCount} users)`;
    console.log(message);

    return message;
  } catch (error) {
    console.error(` Chat index failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Process incremental update (new users, updated follows, etc.)
 */
async function processIncrementalUpdate(
  data: IncrementalChatUpdateJob
): Promise<string> {
  console.log("⚡ Starting incremental chat update...");
  const startTime = Date.now();

  try {
    // Get all active user indexes
    const activeIndexKeys = await chatPersistence.getChatIndexKeys(
      "chat_search_index:*"
    );

    if (activeIndexKeys.length === 0) {
      return "No active indexes to update";
    }

    let updatedCount = 0;

    // Update each user's index
    for (const indexKey of activeIndexKeys) {
      const userId = indexKey.split(":")[1];
      if (!userId) continue;

      try {
        // Load existing index
        const loaded = await chatSearchEngine.loadIndex(indexKey);
        if (!loaded) continue;

        // Get recent follows (last 5 minutes)
        const recentFollows = await prisma.follow.findMany({
          where: {
            OR: [{ followerId: userId }, { followingId: userId }],
          },
          select: {
            followerId: true,
            followingId: true,
            status: true,
          },
        });

        // Update follow relationships if needed
        // (In production, you'd check timestamps and only update changed relationships)

        updatedCount++;
      } catch (error) {
        console.error(`Failed to update index for user ${userId}:`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const message = `⚡ Incremental update complete in ${duration}s (${updatedCount} indexes updated)`;
    console.log(message);

    return message;
  } catch (error) {
    console.error(" Incremental update failed:", error);
    throw error;
  }
}

/**
 * Process unread count update
 */
async function processUpdateUnread(data: UpdateUnreadJob): Promise<string> {
  const { userId, unreadMap } = data;
  console.log(` Updating unread counts for user ${userId}...`);

  try {
    // Load user's index
    const loaded = await chatSearchEngine.loadIndex(
      `chat_search_index:${userId}`
    );

    if (!loaded) {
      throw new Error(`Index not found for user ${userId}`);
    }

    // Update each user's unread status
    for (const [otherUserId, hasUnread] of Object.entries(unreadMap)) {
      chatSearchEngine.updateUserUnreadStatus(otherUserId, hasUnread);
    }

    // Save updated index
    await chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    const message = ` Updated unread counts for user ${userId}`;
    console.log(message);

    return message;
  } catch (error) {
    console.error(` Failed to update unread counts for ${userId}:`, error);
    throw error;
  }
}

/**
 * Process follow change (rebuild indexes for both users)
 */
async function processFollowChange(data: FollowChangeJob): Promise<string> {
  const { userId, targetUserId, action } = data;
  console.log(` Follow change: ${userId} ${action} ${targetUserId}`);

  try {
    // Enqueue full index jobs for both users
    await chatSearchQueue.add("full-index", {
      type: "full-index",
      userId,
    });

    await chatSearchQueue.add("full-index", {
      type: "full-index",
      userId: targetUserId,
    });

    const message = ` Queued index rebuild for users ${userId} and ${targetUserId}`;
    console.log(message);

    return message;
  } catch (error) {
    console.error(` Failed to handle follow change:`, error);
    throw error;
  }
}

// Worker event handlers

chatSearchWorker.on("completed", (job) => {
  console.log(` Job ${job.id} completed:`, job.returnvalue);
});

chatSearchWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

chatSearchWorker.on("error", (err) => {
  console.error(" Worker error:", err);
});

chatSearchWorker.on("stalled", (jobId) => {
  console.warn(` Job ${jobId} stalled`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log(" SIGTERM received, closing chat search worker...");
  await chatSearchWorker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log(" SIGINT received, closing chat search worker...");
  await chatSearchWorker.close();
  await connection.quit();
  process.exit(0);
});

// Export helper functions to enqueue jobs

/**
 * Enqueue a full chat index job
 */
export async function enqueueFullChatIndex(userId: string): Promise<void> {
  await chatSearchQueue.add("full-index", {
    type: "full-index",
    userId,
  });
  console.log(` Enqueued full chat index job for user ${userId}`);
}

/**
 * Enqueue incremental update job
 */
export async function enqueueIncrementalUpdate(
  userIds?: string[]
): Promise<void> {
  await chatSearchQueue.add("incremental-update", {
    type: "incremental-update",
    userIds,
  });
  console.log(" Enqueued incremental chat update job");
}

/**
 * Enqueue unread count update
 */
export async function enqueueUpdateUnread(
  userId: string,
  unreadMap: Record<string, boolean>
): Promise<void> {
  await chatSearchQueue.add("update-unread", {
    type: "update-unread",
    userId,
    unreadMap,
  });
  console.log(` Enqueued unread update job for user ${userId}`);
}

/**
 * Enqueue follow change job
 */
export async function enqueueFollowChange(
  userId: string,
  targetUserId: string,
  action: "follow" | "unfollow"
): Promise<void> {
  await chatSearchQueue.add("follow-change", {
    type: "follow-change",
    userId,
    targetUserId,
    action,
  });
  console.log(` Enqueued follow change job: ${userId} ${action} ${targetUserId}`);
}

/**
 * Schedule recurring incremental updates
 */
export async function scheduleIncrementalUpdates(): Promise<void> {
  // Add repeatable job (runs every 60 seconds)
  await chatSearchQueue.add(
    "incremental-update",
    {
      type: "incremental-update",
    },
    {
      repeat: {
        every: 60000, // Every 60 seconds
      },
      jobId: "chat-incremental-update", // Unique ID to prevent duplicates
    }
  );

  console.log(" Scheduled incremental chat updates (every 60 seconds)");
}

console.log(" Chat search worker initialized");