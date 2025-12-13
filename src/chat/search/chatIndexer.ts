// src/chat/search/chatIndexer.ts
import { ParsedChatUser } from "./chatParser";

export interface ChatIndexDocument {
  users: Map<string, ParsedChatUser>;
  usernameIndex: Map<string, Set<string>>; // username token -> user IDs
  nameIndex: Map<string, Set<string>>; // name token -> user IDs
  bioIndex: Map<string, Set<string>>; // bio token -> user IDs
  followingIndex: Set<string>; // Users you follow
  followersIndex: Set<string>; // Users who follow you
  mutualIndex: Set<string>; // Mutual follows
  verifiedIndex: Set<string>; // Verified users
  unreadIndex: Set<string>; // Users with unread messages
}

export class ChatIndexer {
  private users: Map<string, ParsedChatUser> = new Map();
  private usernameIndex: Map<string, Set<string>> = new Map();
  private nameIndex: Map<string, Set<string>> = new Map();
  private bioIndex: Map<string, Set<string>> = new Map();
  private followingIndex: Set<string> = new Set();
  private followersIndex: Set<string> = new Set();
  private mutualIndex: Set<string> = new Set();
  private verifiedIndex: Set<string> = new Set();
  private unreadIndex: Set<string> = new Set();

  /**
   * Index a single chat user
   */
  indexChatUser(user: ParsedChatUser): void {
    // Store user document
    this.users.set(user.id, user);

    // Index username tokens
    user.usernameTokens.forEach((token) => {
      if (!this.usernameIndex.has(token)) {
        this.usernameIndex.set(token, new Set());
      }
      this.usernameIndex.get(token)!.add(user.id);
    });

    // Index name tokens
    user.nameTokens.forEach((token) => {
      if (!this.nameIndex.has(token)) {
        this.nameIndex.set(token, new Set());
      }
      this.nameIndex.get(token)!.add(user.id);
    });

    // Index bio tokens
    user.bioTokens.forEach((token) => {
      if (!this.bioIndex.has(token)) {
        this.bioIndex.set(token, new Set());
      }
      this.bioIndex.get(token)!.add(user.id);
    });

    // Index relationships
    if (user.isFollowing) {
      this.followingIndex.add(user.id);
    }
    if (user.isFollowedBy) {
      this.followersIndex.add(user.id);
    }
    if (user.isFollowing && user.isFollowedBy) {
      this.mutualIndex.add(user.id);
    }

    // Index verified status
    if (user.verified) {
      this.verifiedIndex.add(user.id);
    }

    // Index unread messages
    if (user.hasUnreadMessages) {
      this.unreadIndex.add(user.id);
    }
  }

  /**
   * Batch index chat users
   */
  indexChatUsers(users: ParsedChatUser[]): void {
    users.forEach((user) => this.indexChatUser(user));
  }

  /**
   * Search for chat users by query tokens
   */
  searchChatUsers(tokens: string[]): Set<string> {
    if (tokens.length === 0) return new Set();

    const results: Set<string>[] = [];

    // Search in username (highest priority)
    tokens.forEach((token) => {
      const usernameMatches = this.usernameIndex.get(token.toLowerCase()) || new Set<string>();
      if (usernameMatches.size > 0) {
        results.push(usernameMatches);
      }
    });

    // Search in name
    tokens.forEach((token) => {
      const nameMatches = this.nameIndex.get(token.toLowerCase()) || new Set<string>();
      if (nameMatches.size > 0) {
        results.push(nameMatches);
      }
    });

    // Search in bio
    tokens.forEach((token) => {
      const bioMatches = this.bioIndex.get(token.toLowerCase()) || new Set<string>();
      if (bioMatches.size > 0) {
        results.push(bioMatches);
      }
    });

    // Union of all results (any match)
    return this.union(results);
  }

  /**
   * Search by exact username
   */
  searchByUsername(username: string): Set<string> {
    return this.usernameIndex.get(username.toLowerCase()) || new Set();
  }

  /**
   * Get users you follow
   */
  getFollowingUsers(): Set<string> {
    return new Set(this.followingIndex);
  }

  /**
   * Get users who follow you
   */
  getFollowerUsers(): Set<string> {
    return new Set(this.followersIndex);
  }

  /**
   * Get mutual follows
   */
  getMutualFollows(): Set<string> {
    return new Set(this.mutualIndex);
  }

  /**
   * Get verified users
   */
  getVerifiedUsers(): Set<string> {
    return new Set(this.verifiedIndex);
  }

  /**
   * Get users with unread messages
   */
  getUnreadUsers(): Set<string> {
    return new Set(this.unreadIndex);
  }

  /**
   * Get user by ID
   */
  getChatUser(id: string): ParsedChatUser | undefined {
    return this.users.get(id);
  }

  /**
   * Get multiple users by IDs
   */
  getChatUsers(ids: string[]): ParsedChatUser[] {
    return ids
      .map((id) => this.users.get(id))
      .filter((u) => u !== undefined) as ParsedChatUser[];
  }

  /**
   * Update user's unread message status
   */
  updateUnreadStatus(userId: string, hasUnread: boolean): void {
    const user = this.users.get(userId);
    if (!user) return;

    user.hasUnreadMessages = hasUnread;

    // Update index
    if (hasUnread) {
      this.unreadIndex.add(userId);
      user.score += 2000;
    } else {
      this.unreadIndex.delete(userId);
      user.score -= 2000;
    }
  }

  /**
   * Export index for persistence
   */
  exportIndex(): ChatIndexDocument {
    return {
      users: new Map(this.users),
      usernameIndex: new Map(
        Array.from(this.usernameIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      nameIndex: new Map(
        Array.from(this.nameIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      bioIndex: new Map(
        Array.from(this.bioIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      followingIndex: new Set(this.followingIndex),
      followersIndex: new Set(this.followersIndex),
      mutualIndex: new Set(this.mutualIndex),
      verifiedIndex: new Set(this.verifiedIndex),
      unreadIndex: new Set(this.unreadIndex),
    };
  }

  /**
   * Import index from persistence
   */
  importIndex(doc: ChatIndexDocument): void {
    this.users = new Map(doc.users);
    this.usernameIndex = new Map(
      Array.from(doc.usernameIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.nameIndex = new Map(
      Array.from(doc.nameIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.bioIndex = new Map(
      Array.from(doc.bioIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.followingIndex = new Set(doc.followingIndex);
    this.followersIndex = new Set(doc.followersIndex);
    this.mutualIndex = new Set(doc.mutualIndex);
    this.verifiedIndex = new Set(doc.verifiedIndex);
    this.unreadIndex = new Set(doc.unreadIndex);
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalUsers: this.users.size,
      totalUsernameTokens: this.usernameIndex.size,
      totalNameTokens: this.nameIndex.size,
      totalBioTokens: this.bioIndex.size,
      followingCount: this.followingIndex.size,
      followersCount: this.followersIndex.size,
      mutualCount: this.mutualIndex.size,
      verifiedCount: this.verifiedIndex.size,
      unreadCount: this.unreadIndex.size,
    };
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.users.clear();
    this.usernameIndex.clear();
    this.nameIndex.clear();
    this.bioIndex.clear();
    this.followingIndex.clear();
    this.followersIndex.clear();
    this.mutualIndex.clear();
    this.verifiedIndex.clear();
    this.unreadIndex.clear();
  }

  /**
   * Union of multiple sets
   */
  private union(sets: Set<string>[]): Set<string> {
    const result = new Set<string>();
    sets.forEach((set) => {
      set.forEach((item) => result.add(item));
    });
    return result;
  }
}