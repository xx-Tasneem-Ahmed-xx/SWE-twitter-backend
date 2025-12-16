// src/chat/search/chatPersistence.ts
import Redis from "ioredis";
import { ChatIndexDocument } from "./chatIndexer";
import { ParsedChatUser } from "./chatParser";

/**
 * Chat-specific persistence manager
 * Handles serialization/deserialization of chat search indexes
 */
export class ChatPersistenceManager {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Save chat index to Redis
   */
  async saveChatIndex(key: string, indexDoc: ChatIndexDocument): Promise<void> {
    const serialized = this.serializeChatIndex(indexDoc);
    await this.redis.set(key, JSON.stringify(serialized));
    console.log(`✅ Chat index saved to Redis with key: ${key}`);
  }

  /**
   * Load chat index from Redis
   */
  async loadChatIndex(key: string): Promise<ChatIndexDocument | null> {
    const data = await this.redis.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return this.deserializeChatIndex(parsed);
  }

  /**
   * Check if chat index exists
   */
  async chatIndexExists(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Delete chat index
   */
  async deleteChatIndex(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Get chat index metadata
   */
  async getChatIndexMetadata(key: string): Promise<any> {
    const metaKey = `${key}:metadata`;
    const data = await this.redis.get(metaKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Save chat index metadata
   */
  async saveChatIndexMetadata(key: string, metadata: any): Promise<void> {
    const metaKey = `${key}:metadata`;
    await this.redis.set(metaKey, JSON.stringify(metadata));
  }

  /**
   * Get all chat index keys for a user pattern
   */
  async getChatIndexKeys(pattern: string = "chat_search_index:*"): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  /**
   * Delete all chat indexes (cleanup)
   */
  async deleteAllChatIndexes(): Promise<void> {
    const keys = await this.getChatIndexKeys();
    if (keys.length > 0) {
      await this.redis.del(...keys);
      console.log(`🗑️ Deleted ${keys.length} chat indexes`);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Serialize chat index for storage
   */
  private serializeChatIndex(indexDoc: ChatIndexDocument): any {
    return {
      users: Array.from(indexDoc.users.entries()),
      usernameIndex: Array.from(indexDoc.usernameIndex.entries()).map(
        ([k, v]) => [k, Array.from(v)]
      ),
      nameIndex: Array.from(indexDoc.nameIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      bioIndex: Array.from(indexDoc.bioIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      followingIndex: Array.from(indexDoc.followingIndex),
      followersIndex: Array.from(indexDoc.followersIndex),
      mutualIndex: Array.from(indexDoc.mutualIndex),
      verifiedIndex: Array.from(indexDoc.verifiedIndex),
      unreadIndex: Array.from(indexDoc.unreadIndex),
    };
  }

  /**
   * Deserialize chat index from storage
   */
  private deserializeChatIndex(data: any): ChatIndexDocument {
    return {
      users: new Map(data.users),
      usernameIndex: new Map(
        data.usernameIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])
      ),
      nameIndex: new Map(
        data.nameIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])
      ),
      bioIndex: new Map(
        data.bioIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])
      ),
      followingIndex: new Set(data.followingIndex),
      followersIndex: new Set(data.followersIndex),
      mutualIndex: new Set(data.mutualIndex),
      verifiedIndex: new Set(data.verifiedIndex),
      unreadIndex: new Set(data.unreadIndex || []), // Handle old indexes without unreadIndex
    };
  }
}