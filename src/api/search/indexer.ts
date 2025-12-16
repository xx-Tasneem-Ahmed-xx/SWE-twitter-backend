// src/search/indexer.ts
import { ParsedTweet, ParsedUser } from "./parser";

export interface IndexDocument {
  tweets: Map<string, ParsedTweet>;
  users: Map<string, ParsedUser>;
  tweetIndex: Map<string, Set<string>>; // token -> tweet IDs
  userIndex: Map<string, Set<string>>; // token -> user IDs
  hashtagIndex: Map<string, Set<string>>; // hashtag -> tweet IDs
  mentionIndex: Map<string, Set<string>>; // mention -> tweet IDs
  mediaIndex: Set<string>; // tweet IDs with media
}

export class Indexer {
  private tweets: Map<string, ParsedTweet> = new Map();
  private users: Map<string, ParsedUser> = new Map();
  private tweetIndex: Map<string, Set<string>> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  private hashtagIndex: Map<string, Set<string>> = new Map();
  private mentionIndex: Map<string, Set<string>> = new Map();
  private mediaIndex: Set<string> = new Set();

  /**
   * Index a single tweet
   */
  indexTweet(tweet: ParsedTweet): void {
    // Store tweet document
    this.tweets.set(tweet.id, tweet);

    // Index content tokens
    tweet.contentTokens.forEach((token) => {
      if (!this.tweetIndex.has(token)) {
        this.tweetIndex.set(token, new Set());
      }
      this.tweetIndex.get(token)!.add(tweet.id);
    });

    // Index hashtags
    tweet.hashtags.forEach((hashtag) => {
      const normalizedHashtag = hashtag.toLowerCase();
      if (!this.hashtagIndex.has(normalizedHashtag)) {
        this.hashtagIndex.set(normalizedHashtag, new Set());
      }
      this.hashtagIndex.get(normalizedHashtag)!.add(tweet.id);
    });

    // Index mentions
    tweet.mentions.forEach((mention) => {
      if (!this.mentionIndex.has(mention)) {
        this.mentionIndex.set(mention, new Set());
      }
      this.mentionIndex.get(mention)!.add(tweet.id);
    });

    // Index username
    const username = tweet.username.toLowerCase();
    if (!this.tweetIndex.has(username)) {
      this.tweetIndex.set(username, new Set());
    }
    this.tweetIndex.get(username)!.add(tweet.id);

    // Index media
    if (tweet.mediaIds.length > 0) {
      this.mediaIndex.add(tweet.id);
    }
  }

  /**
   * Index a single user
   */
  indexUser(user: ParsedUser): void {
    // Store user document
    this.users.set(user.id, user);

    // Index username
    const username = user.username.toLowerCase();
    if (!this.userIndex.has(username)) {
      this.userIndex.set(username, new Set());
    }
    this.userIndex.get(username)!.add(user.id);

    // Index name tokens
    if (user.name) {
      const nameTokens = user.name
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      nameTokens.forEach((token) => {
        if (!this.userIndex.has(token)) {
          this.userIndex.set(token, new Set());
        }
        this.userIndex.get(token)!.add(user.id);
      });
    }

    // Index bio tokens
    user.bioTokens.forEach((token) => {
      if (!this.userIndex.has(token)) {
        this.userIndex.set(token, new Set());
      }
      this.userIndex.get(token)!.add(user.id);
    });
  }

  /**
   * Batch index tweets
   */
  indexTweets(tweets: ParsedTweet[]): void {
    tweets.forEach((tweet) => this.indexTweet(tweet));
  }

  /**
   * Batch index users
   */
  indexUsers(users: ParsedUser[]): void {
    users.forEach((user) => this.indexUser(user));
  }

  /**
   * Search tweets by tokens
   */
  searchTweets(tokens: string[]): Set<string> {
    if (tokens.length === 0) return new Set();

    // Get tweet IDs that match all tokens (AND operation)
    const results = tokens.map((token) => {
      return this.tweetIndex.get(token.toLowerCase()) || new Set<string>();
    });

    // Intersection of all result sets
    return this.intersect(results);
  }

  /**
   * Search tweets by hashtag
   */
  searchByHashtag(hashtag: string): Set<string> {
    return this.hashtagIndex.get(hashtag.toLowerCase()) || new Set();
  }

  /**
   * Search tweets by mention
   */
  searchByMention(mention: string): Set<string> {
    return this.mentionIndex.get(mention.toLowerCase()) || new Set();
  }

  /**
   * Get tweets with media
   */
  getMediaTweets(): Set<string> {
    return new Set(this.mediaIndex);
  }

  /**
   * Search users
   */
  searchUsers(tokens: string[]): Set<string> {
    if (tokens.length === 0) return new Set();

    const results = tokens.map((token) => {
      return this.userIndex.get(token.toLowerCase()) || new Set<string>();
    });

    return this.union(results);
  }

  /**
   * Get tweet by ID
   */
  getTweet(id: string): ParsedTweet | undefined {
    return this.tweets.get(id);
  }

  /**
   * Get user by ID
   */
  getUser(id: string): ParsedUser | undefined {
    return this.users.get(id);
  }

  /**
   * Get multiple tweets by IDs
   */
  getTweets(ids: string[]): ParsedTweet[] {
    return ids.map((id) => this.tweets.get(id)).filter((t) => t !== undefined) as ParsedTweet[];
  }

  /**
   * Get multiple users by IDs
   */
  getUsers(ids: string[]): ParsedUser[] {
    return ids.map((id) => this.users.get(id)).filter((u) => u !== undefined) as ParsedUser[];
  }

  /**
   * Export index for persistence
   */
  exportIndex(): IndexDocument {
    return {
      tweets: new Map(this.tweets),
      users: new Map(this.users),
      tweetIndex: new Map(
        Array.from(this.tweetIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      userIndex: new Map(
        Array.from(this.userIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      hashtagIndex: new Map(
        Array.from(this.hashtagIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      mentionIndex: new Map(
        Array.from(this.mentionIndex.entries()).map(([k, v]) => [k, new Set(v)])
      ),
      mediaIndex: new Set(this.mediaIndex),
    };
  }

  /**
   * Import index from persistence
   */
  importIndex(doc: IndexDocument): void {
    this.tweets = new Map(doc.tweets);
    this.users = new Map(doc.users);
    this.tweetIndex = new Map(
      Array.from(doc.tweetIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.userIndex = new Map(
      Array.from(doc.userIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.hashtagIndex = new Map(
      Array.from(doc.hashtagIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.mentionIndex = new Map(
      Array.from(doc.mentionIndex.entries()).map(([k, v]) => [k, new Set(v)])
    );
    this.mediaIndex = new Set(doc.mediaIndex);
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalTweets: this.tweets.size,
      totalUsers: this.users.size,
      totalTokens: this.tweetIndex.size + this.userIndex.size,
      totalHashtags: this.hashtagIndex.size,
      totalMentions: this.mentionIndex.size,
      tweetsWithMedia: this.mediaIndex.size,
    };
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.tweets.clear();
    this.users.clear();
    this.tweetIndex.clear();
    this.userIndex.clear();
    this.hashtagIndex.clear();
    this.mentionIndex.clear();
    this.mediaIndex.clear();
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