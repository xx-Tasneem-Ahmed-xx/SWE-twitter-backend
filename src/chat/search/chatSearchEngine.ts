// src/chat/search/chatSearchEngine.ts
import { ChatIndexer } from "./chatIndexer";
import { ChatParser, ParsedChatUser } from "./chatParser";
import { ChatPersistenceManager } from "./chatPersistence";

export interface ChatSearchCursor {
  id: string;
  score: number;
}

export interface ChatSearchResult {
  data: ParsedChatUser[];
  cursor: string | null;
  total: number;
}

export enum ChatSearchFilter {
  ALL = "all",
  FOLLOWING = "following", // People you follow
  FOLLOWERS = "followers", // People who follow you
  MUTUAL = "mutual", // Mutual follows
  VERIFIED = "verified", // Verified users only
  UNREAD = "unread", // Users with unread messages
}

export class ChatSearchEngine {
  constructor(
    private indexer: ChatIndexer,
    private parser: ChatParser,
    private persistence: ChatPersistenceManager
  ) {}

  /**
   * Search for chat users with filters
   */
  searchChatUsers(
    query: string,
    limit: number = 20,
    filter: ChatSearchFilter = ChatSearchFilter.ALL,
    cursor?: ChatSearchCursor
  ): ChatSearchResult {
    const parsedQuery = this.parser.parseChatQuery(query);

    let userIds = new Set<string>();

    // Exact username search
    if (parsedQuery.exactUsername) {
      userIds = this.indexer.searchByUsername(parsedQuery.exactUsername);
    } else if (parsedQuery.tokens.length > 0) {
      // Regular search
      userIds = this.indexer.searchChatUsers(parsedQuery.tokens);
    } else {
      // Empty query - return all users (for browsing)
      const allUsers = this.indexer.getChatUsers(
        Array.from(this.indexer["users"].keys())
      );
      userIds = new Set(allUsers.map((u) => u.id));
    }

    // Apply filters
    userIds = this.applyFilter(userIds, filter);

    // Get users and sort by score (relevance)
    let users = this.indexer
      .getChatUsers(Array.from(userIds))
      .sort((a, b) => b.score - a.score);

    // Apply cursor filtering if provided
    if (cursor?.id && cursor?.score !== undefined) {
      const cursorIndex = users.findIndex(
        (u) => u.id === cursor.id && u.score === cursor.score
      );
      if (cursorIndex !== -1) {
        users = users.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to check if there's a next page
    const hasNextPage = users.length > limit;
    const paginatedUsers = hasNextPage ? users.slice(0, limit) : users;

    // Generate next cursor
    const lastUser = paginatedUsers[paginatedUsers.length - 1];
    const nextCursor =
      hasNextPage && lastUser
        ? this.encodeCursor({ id: lastUser.id, score: lastUser.score })
        : null;

    return {
      data: paginatedUsers,
      cursor: nextCursor,
      total: userIds.size,
    };
  }

  /**
   * Get suggested users (people you might want to chat with)
   */
  getSuggestedUsers(limit: number = 10): ParsedChatUser[] {
    // Priority order:
    // 1. Mutual follows
    // 2. People who follow you
    // 3. People you follow
    // 4. Verified users

    const mutualIds = this.indexer.getMutualFollows();
    const followerIds = this.indexer.getFollowerUsers();
    const followingIds = this.indexer.getFollowingUsers();
    const verifiedIds = this.indexer.getVerifiedUsers();

    const mutualUsers = this.indexer
      .getChatUsers(Array.from(mutualIds))
      .sort((a, b) => b.score - a.score);

    const followerUsers = this.indexer
      .getChatUsers(Array.from(followerIds))
      .filter((u) => !mutualIds.has(u.id))
      .sort((a, b) => b.score - a.score);

    const followingUsers = this.indexer
      .getChatUsers(Array.from(followingIds))
      .filter((u) => !mutualIds.has(u.id) && !followerIds.has(u.id))
      .sort((a, b) => b.score - a.score);

    const verifiedUsers = this.indexer
      .getChatUsers(Array.from(verifiedIds))
      .filter(
        (u) =>
          !mutualIds.has(u.id) &&
          !followerIds.has(u.id) &&
          !followingIds.has(u.id)
      )
      .sort((a, b) => b.score - a.score);

    // Combine in priority order
    const suggestions = [
      ...mutualUsers.slice(0, 4),
      ...followerUsers.slice(0, 3),
      ...followingUsers.slice(0, 2),
      ...verifiedUsers.slice(0, 1),
    ];

    return suggestions.slice(0, limit);
  }

  /**
   * Get recent chat users (users with existing conversations)
   */
  getRecentChatUsers(userIds: string[], limit: number = 20): ParsedChatUser[] {
    const users = this.indexer
      .getChatUsers(userIds)
      .sort((a, b) => {
        // Sort by: unread messages > score
        if (a.hasUnreadMessages !== b.hasUnreadMessages) {
          return a.hasUnreadMessages ? -1 : 1;
        }
        return b.score - a.score;
      })
      .slice(0, limit);

    return users;
  }

  /**
   * Apply search filter
   */
  private applyFilter(
    userIds: Set<string>,
    filter: ChatSearchFilter
  ): Set<string> {
    switch (filter) {
      case ChatSearchFilter.FOLLOWING:
        return this.intersect([userIds, this.indexer.getFollowingUsers()]);

      case ChatSearchFilter.FOLLOWERS:
        return this.intersect([userIds, this.indexer.getFollowerUsers()]);

      case ChatSearchFilter.MUTUAL:
        return this.intersect([userIds, this.indexer.getMutualFollows()]);

      case ChatSearchFilter.VERIFIED:
        return this.intersect([userIds, this.indexer.getVerifiedUsers()]);

      case ChatSearchFilter.UNREAD:
        return this.intersect([userIds, this.indexer.getUnreadUsers()]);

      case ChatSearchFilter.ALL:
      default:
        return userIds;
    }
  }

  /**
   * Intersection of multiple sets
   */
  private intersect(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set();
    if (sets.length === 1) return sets[0];

    return sets.reduce((acc, set) => {
      return new Set([...acc].filter((x) => set.has(x)));
    });
  }

  /**
   * Get index statistics
   */
  getStats() {
    return this.indexer.getStats();
  }

  /**
   * Save index to persistence (reuse Redis)
   */
  async saveIndex(key: string = "chat_search_index"): Promise<void> {
    const indexDoc = this.indexer.exportIndex();
    await this.persistence.saveChatIndex(key, indexDoc);

    const metadata = {
      lastUpdated: new Date().toISOString(),
      stats: this.getStats(),
    };
    await this.persistence.saveChatIndexMetadata(key, metadata);
  }

  /**
   * Load index from persistence
   */
  async loadIndex(key: string = "chat_search_index"): Promise<boolean> {
    const indexDoc = await this.persistence.loadChatIndex(key);
    if (!indexDoc) return false;

    this.indexer.importIndex(indexDoc);
    return true;
  }

  /**
   * Encode cursor to base64 string
   */
  private encodeCursor(cursor: ChatSearchCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString("base64");
  }

  /**
   * Decode cursor from base64 string
   */
  decodeCursor(encodedCursor: string): ChatSearchCursor | null {
    try {
      const decoded = Buffer.from(encodedCursor, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Update user's unread message status
   */
  updateUserUnreadStatus(userId: string, hasUnread: boolean): void {
    this.indexer.updateUnreadStatus(userId, hasUnread);
  }
}