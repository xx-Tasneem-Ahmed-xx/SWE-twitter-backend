// src/search/parser.ts
import { CrawledTweet, CrawledUser } from "./crawler";

export interface ParsedTweet {
  id: string;
  content: string;
  contentTokens: string[];
  createdAt: Date;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  quotesCount: number;
  userId: string;
  username: string;
  name: string | null;
  verified: boolean;
  profileMediaId: string | null;
  mediaIds: string[];
  hashtags: string[];
  mentions: string[];
  score: number; // Engagement score for ranking
}

export interface ParsedUser {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  bioTokens: string[];
  verified: boolean;
  profileMediaId: string | null;
  followersCount: number;
  followingsCount: number;
  score: number; // Popularity score
}

export class Parser {
  /**
   * Parse tweet content and extract tokens
   */
  parseTweet(tweet: CrawledTweet): ParsedTweet {
    const contentTokens = this.tokenize(tweet.content);
    const mentions = this.extractMentions(tweet.content);
    const score = this.calculateTweetScore(tweet);

    return {
      id: tweet.id,
      content: tweet.content,
      contentTokens,
      createdAt: tweet.createdAt,
      likesCount: tweet.likesCount,
      retweetCount: tweet.retweetCount,
      repliesCount: tweet.repliesCount,
      quotesCount: tweet.quotesCount,
      userId: tweet.userId,
      username: tweet.user.username,
      name: tweet.user.name,
      verified: tweet.user.verified,
      profileMediaId: tweet.user.profileMediaId,
      mediaIds: tweet.mediaIds,
      hashtags: tweet.hashtags,
      mentions,
      score,
    };
  }

  /**
   * Parse user profile
   */
  parseUser(user: CrawledUser): ParsedUser {
    const bioTokens = user.bio ? this.tokenize(user.bio) : [];
    const score = this.calculateUserScore(user);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      bioTokens,
      verified: user.verified,
      profileMediaId: user.profileMediaId,
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      score,
    };
  }

  /**
   * Batch parse tweets
   */
  parseTweets(tweets: CrawledTweet[]): ParsedTweet[] {
    return tweets.map((tweet) => this.parseTweet(tweet));
  }

  /**
   * Batch parse users
   */
  parseUsers(users: CrawledUser[]): ParsedUser[] {
    return users.map((user) => this.parseUser(user));
  }

  /**
   * Tokenize text for search
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s#@]/g, " ") // Keep hashtags and mentions
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .filter((token) => !this.isStopWord(token));
  }

  /**
   * Extract mentions from text
   */
  private extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1].toLowerCase());
    }

    return mentions;
  }

  /**
   * Calculate engagement score for ranking
   */
  private calculateTweetScore(tweet: CrawledTweet): number {
    const now = new Date();
    const tweetAge = now.getTime() - tweet.createdAt.getTime();
    const ageInHours = tweetAge / (1000 * 60 * 60);

    // Weights for different engagement metrics
    const likeWeight = 1;
    const retweetWeight = 2;
    const replyWeight = 1.5;
    const quoteWeight = 2.5;

    // Calculate engagement score
    const engagementScore =
      tweet.likesCount * likeWeight +
      tweet.retweetCount * retweetWeight +
      tweet.repliesCount * replyWeight +
      tweet.quotesCount * quoteWeight;

    // Time decay factor (tweets lose relevance over time)
    const decayFactor = Math.exp(-ageInHours / 48); // Half-life of 48 hours

    return engagementScore * decayFactor;
  }

  /**
   * Calculate user popularity score
   */
  private calculateUserScore(user: CrawledUser): number {
    const followerScore = Math.log10(user.followersCount + 1) * 10;
    const verifiedBonus = user.verified ? 50 : 0;

    return followerScore + verifiedBonus;
  }

  /**
   * Stop words to filter out
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "a",
      "an",
      "and",
      "are",
      "as",
      "at",
      "be",
      "but",
      "by",
      "for",
      "if",
      "in",
      "into",
      "is",
      "it",
      "no",
      "not",
      "of",
      "on",
      "or",
      "such",
      "that",
      "the",
      "their",
      "then",
      "there",
      "these",
      "they",
      "this",
      "to",
      "was",
      "will",
      "with",
    ]);

    return stopWords.has(word);
  }

  /**
   * Parse search query
   */
  parseQuery(query: string): {
    tokens: string[];
    hashtags: string[];
    mentions: string[];
    hasMedia: boolean;
  } {
    const tokens = this.tokenize(query);
    const hashtags = tokens.filter((t) => t.startsWith("#")).map((t) => t.slice(1));
    const mentions = tokens.filter((t) => t.startsWith("@")).map((t) => t.slice(1));
    const hasMedia = query.toLowerCase().includes("filter:media");

    return {
      tokens: tokens.filter((t) => !t.startsWith("#") && !t.startsWith("@")),
      hashtags,
      mentions,
      hasMedia,
    };
  }
}