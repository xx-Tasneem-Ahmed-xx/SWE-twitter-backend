// src/background/jobs/chatSearchJobs.ts
import { ChatCrawler } from "@/chat/search/chatCrawler";
import { ChatParser } from "@/chat/search/chatParser";
import { ChatIndexer } from "@/chat/search/chatIndexer";
import { ChatSearchEngine } from "@/chat/search/chatSearchEngine";
import { ChatPersistenceManager } from "@/chat/search/chatPersistence";

let chatCrawler: ChatCrawler;
let chatParser: ChatParser;
let chatIndexer: ChatIndexer;
let chatSearchEngine: ChatSearchEngine;
let chatPersistence: ChatPersistenceManager;

let chatIncrementalInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the chat job system with search components
 */
export function initializeChatJobSystem(components: {
  chatCrawler: ChatCrawler;
  chatParser: ChatParser;
  chatIndexer: ChatIndexer;
  chatSearchEngine: ChatSearchEngine;
  chatPersistence: ChatPersistenceManager;
}) {
  chatCrawler = components.chatCrawler;
  chatParser = components.chatParser;
  chatIndexer = components.chatIndexer;
  chatSearchEngine = components.chatSearchEngine;
  chatPersistence = components.chatPersistence;
}

/**
 * Enqueue a full chat index job for a specific user
 * Each user gets their own personalized chat search index
 */
export async function enqueueFullChatIndex(userId: string): Promise<void> {
  console.log(`📋 Enqueueing full chat index job for user ${userId}...`);

  // Run in background without blocking
  setImmediate(async () => {
    await performFullChatIndex(userId);
  });
}

/**
 * Perform a full index of all users for chat search (personalized per user)
 */
async function performFullChatIndex(userId: string): Promise<void> {
  console.log(`🔄 Starting full chat index for user ${userId}...`);
  const startTime = Date.now();

  try {
    // Clear existing index
    chatIndexer.clear();
    console.log("🧹 Cleared existing chat index");

    // First pass: collect all user IDs
    const allUserIds: string[] = [];
    console.log("👥 Collecting user IDs...");
    
    for await (const batch of chatCrawler.crawlChatUsersInBatches(userId, 1000)) {
      allUserIds.push(...batch.map(u => u.id));
    }

    // Get unread message counts for all users
    console.log("📬 Fetching unread message counts...");
    const unreadCounts = await chatCrawler.getUnreadCounts(userId, allUserIds);

    // Second pass: index all users with unread status
    let userCount = 0;
    console.log("📝 Indexing chat users...");

    for await (const batch of chatCrawler.crawlChatUsersInBatches(userId, 1000)) {
      const parsed = batch.map((u) => {
        const hasUnread = unreadCounts.get(u.id) ? true : false;
        return chatParser.parseChatUser(u, hasUnread);
      });
      chatIndexer.indexChatUsers(parsed);
      userCount += batch.length;

      if (userCount % 5000 === 0) {
        console.log(`  ⏳ Indexed ${userCount} chat users...`);
      }
    }

    // Save to Redis with user-specific key
    console.log("💾 Saving chat index to Redis...");
    await chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Chat index complete for user ${userId} in ${duration}s`);
    console.log(`   📊 Users: ${userCount}`);

    const stats = chatSearchEngine.getStats();
    console.log(`   📈 Stats:`, stats);
  } catch (error) {
    console.error(`❌ Chat index failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Schedule incremental updates for chat search (updates new users, etc.)
 * This runs globally for all users' chat indexes
 */
export async function scheduleChatIncrementalUpdates(): Promise<void> {
  // Clear any existing interval
  if (chatIncrementalInterval) {
    clearInterval(chatIncrementalInterval);
  }

  console.log("⏰ Scheduling chat incremental updates (every 60 seconds)...");

  // Run immediately
  await performChatIncrementalUpdate();

  // Then schedule recurring updates
  chatIncrementalInterval = setInterval(async () => {
    await performChatIncrementalUpdate();
  }, 60000); // 60 seconds (longer than tweet updates)
}

/**
 * Perform an incremental update (sync new follows, etc.)
 * This is a lightweight update that doesn't rebuild the entire index
 */
async function performChatIncrementalUpdate(): Promise<void> {
  try {
    const startTime = Date.now();

    // In a real implementation, you would:
    // 1. Check for new users created in the last minute
    // 2. Update follow relationships that changed
    // 3. Update unread message counts
    // 4. Re-save affected user indexes

    // For now, just log that update ran
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⚡ Chat incremental update complete in ${duration}s`);
  } catch (error) {
    console.error("❌ Chat incremental update failed:", error);
    // Don't throw - let it retry on next interval
  }
}

/**
 * Update unread message counts for a user's chat index
 */
export async function updateUnreadCounts(
  userId: string,
  unreadMap: Map<string, boolean>
): Promise<void> {
  try {
    // Update each user's unread status
    for (const [otherUserId, hasUnread] of unreadMap.entries()) {
      chatSearchEngine.updateUserUnreadStatus(otherUserId, hasUnread);
    }

    // Save updated index
    await chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    console.log(`✅ Updated unread counts for user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to update unread counts for ${userId}:`, error);
  }
}

/**
 * Rebuild chat index when follow relationships change
 */
export async function onFollowChange(
  userId: string,
  targetUserId: string,
  action: "follow" | "unfollow"
): Promise<void> {
  try {
    console.log(`🔄 Follow change: ${userId} ${action} ${targetUserId}`);

    // Rebuild index for both users (since relationship affects both)
    await enqueueFullChatIndex(userId);
    await enqueueFullChatIndex(targetUserId);
  } catch (error) {
    console.error(`❌ Failed to handle follow change:`, error);
  }
}

/**
 * Stop all chat search jobs
 */
export function stopChatJobs(): void {
  if (chatIncrementalInterval) {
    clearInterval(chatIncrementalInterval);
    chatIncrementalInterval = null;
    console.log("🛑 Stopped chat incremental updates");
  }
}

/**
 * Check if chat jobs are running
 */
export function isChatJobsRunning(): boolean {
  return chatIncrementalInterval !== null;
}