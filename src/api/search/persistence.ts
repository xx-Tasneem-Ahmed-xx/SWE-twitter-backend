// src/search/persistence.ts
import Redis from "ioredis";
import { IndexDocument } from "./indexer";
import { ParsedTweet, ParsedUser } from "./parser";

export class PersistenceManager {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Save index to Redis
   */
  async saveIndex(key: string, indexDoc: IndexDocument): Promise<void> {
    const serialized = this.serializeIndex(indexDoc);
    await this.redis.set(key, JSON.stringify(serialized));
    console.log(`✅ Index saved to Redis with key: ${key}`);
  }

  /**
   * Load index from Redis
   */
  async loadIndex(key: string): Promise<IndexDocument | null> {
    const data = await this.redis.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return this.deserializeIndex(parsed);
  }

  /**
   * Check if index exists
   */
  async indexExists(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Delete index
   */
  async deleteIndex(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Get index metadata
   */
  async getIndexMetadata(key: string): Promise<any> {
    const metaKey = `${key}:metadata`;
    const data = await this.redis.get(metaKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Save index metadata
   */
  async saveIndexMetadata(key: string, metadata: any): Promise<void> {
    const metaKey = `${key}:metadata`;
    await this.redis.set(metaKey, JSON.stringify(metadata));
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Serialize index for storage
   */
  private serializeIndex(indexDoc: IndexDocument): any {
    return {
      tweets: Array.from(indexDoc.tweets.entries()),
      users: Array.from(indexDoc.users.entries()),
      tweetIndex: Array.from(indexDoc.tweetIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      userIndex: Array.from(indexDoc.userIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      hashtagIndex: Array.from(indexDoc.hashtagIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      mentionIndex: Array.from(indexDoc.mentionIndex.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      mediaIndex: Array.from(indexDoc.mediaIndex),
    };
  }

  /**
   * Deserialize index from storage
   */
  private deserializeIndex(data: any): IndexDocument {
    return {
      tweets: new Map(data.tweets),
      users: new Map(data.users),
      tweetIndex: new Map(data.tweetIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
      userIndex: new Map(data.userIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
      hashtagIndex: new Map(data.hashtagIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
      mentionIndex: new Map(data.mentionIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
      mediaIndex: new Set(data.mediaIndex),
    };
  }
}