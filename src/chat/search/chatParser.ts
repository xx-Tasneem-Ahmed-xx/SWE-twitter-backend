// src/chat/search/chatParser.ts
import { CrawledChatUser } from "./chatCrawler";

export interface ParsedChatUser {
  id: string;
  name: string | null;
  username: string;
  usernameTokens: string[];
  bio: string | null;
  bioTokens: string[];
  verified: boolean;
  profileMediaId: string | null;
  followersCount: number;
  followingsCount: number;
  hasUnreadMessages: boolean;
  mutualFollowers: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  score: number;
  // Search-specific
  nameTokens: string[];
}

export interface ParsedChatQuery {
  tokens: string[];
  exactUsername?: string; // If query starts with @
}

export class ChatParser {
  /**
   * Parse a crawled user into an indexed chat user
   */
  parseChatUser(user: CrawledChatUser, hasUnreadMessages: boolean = false): ParsedChatUser {
    const usernameTokens = this.tokenizeUsername(user.username);
    const nameTokens = user.name ? this.tokenize(user.name) : [];
    const bioTokens = user.bio ? this.tokenize(user.bio) : [];
    const score = this.calculateChatUserScore(user, hasUnreadMessages);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      usernameTokens,
      bio: user.bio,
      bioTokens,
      verified: user.verified,
      profileMediaId: user.profileMediaId,
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      hasUnreadMessages,
      mutualFollowers: user.mutualFollowers,
      isFollowing: user.isFollowing,
      isFollowedBy: user.isFollowedBy,
      score,
      nameTokens,
    };
  }

  /**
   * Parse a search query for chat users
   */
  parseChatQuery(query: string): ParsedChatQuery {
    const trimmed = query.trim();

    // Check if query is an exact username search (@username)
    if (trimmed.startsWith("@")) {
      const username = trimmed.slice(1).toLowerCase();
      return {
        tokens: this.tokenize(username),
        exactUsername: username,
      };
    }

    // Regular search query
    return {
      tokens: this.tokenize(trimmed),
    };
  }

  /**
   * Tokenize text into searchable terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1) // Keep 2+ char tokens for names
      .filter((token) => !this.isStopWord(token));
  }

  /**
   * Tokenize username (no stop word filtering)
   */
  private tokenizeUsername(username: string): string[] {
    const lower = username.toLowerCase();
    const tokens = [lower]; // Full username

    // Add prefix tokens for autocomplete
    // "johnsmith" -> ["j", "jo", "joh", "john", "johns", "johnsmith"]
    for (let i = 1; i <= Math.min(lower.length, 6); i++) {
      tokens.push(lower.slice(0, i));
    }

    return [...new Set(tokens)]; // Remove duplicates
  }

  /**
   * Calculate relevance score for a chat user
   */
  private calculateChatUserScore(user: CrawledChatUser, hasUnreadMessages: boolean): number {
    let score = 0;

    // Following relationship boosts (most important for DMs)
    if (user.isFollowing && user.isFollowedBy) {
      score += 1000; // Mutual following = highest priority
    } else if (user.isFollowing) {
      score += 500; // Following them
    } else if (user.isFollowedBy) {
      score += 300; // They follow you
    }

    // Follower count (logarithmic scale to prevent overwhelming)
    score += Math.log10(user.followersCount + 1) * 10;

    // Verified badge
    if (user.verified) {
      score += 50;
    }

    // Unread messages (highest priority)
    if (hasUnreadMessages) {
      score += 2000; // Show users with unread messages first
    }

    return score;
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "be",
      "to",
      "of",
      "and",
      "a",
      "in",
      "that",
      "have",
      "i",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
      "this",
      "but",
      "his",
      "by",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "or",
      "an",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
    ]);
    return stopWords.has(word);
  }
}