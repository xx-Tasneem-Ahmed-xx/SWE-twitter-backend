// src/search/crawler.ts
import { PrismaClient, Prisma } from "@prisma/client";

export interface CrawledTweet {
  id: string;
  content: string;
  createdAt: Date;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  quotesCount: number;
  userId: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    verified: boolean;
    profileMediaId: string | null;
  };
  mediaIds: string[];
  hashtags: string[];
}

export interface CrawledUser {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  verified: boolean;
  profileMediaId: string | null;
  followersCount: number;
  followingsCount: number;
}

export class Crawler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Crawl all tweets (for full indexing)
   */
  async crawlAllTweets(batchSize: number = 1000): Promise<CrawledTweet[]> {
    const tweets = await this.prisma.tweet.findMany({
      select: this.tweetSelectFields(),
      take: batchSize,
      orderBy: { createdAt: "desc" },
    });

    return this.transformTweets(tweets);
  }

  /**
   * Crawl recent tweets (for incremental updates)
   */
  async crawlRecentTweets(limit: number = 200): Promise<CrawledTweet[]> {
    const tweets = await this.prisma.tweet.findMany({
      select: this.tweetSelectFields(),
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return this.transformTweets(tweets);
  }

  /**
   * Crawl tweets in batches with cursor pagination
   */
  async *crawlTweetsInBatches(
    batchSize: number = 1000
  ): AsyncGenerator<CrawledTweet[], void, unknown> {
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const tweets: any = await this.prisma.tweet.findMany({
        select: this.tweetSelectFields(),
        take: batchSize,
        orderBy: { createdAt: "desc" },
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      if (tweets.length === 0) {
        hasMore = false;
        break;
      }

      yield this.transformTweets(tweets);

      if (tweets.length < batchSize) {
        hasMore = false;
      } else {
        cursor = tweets[tweets.length - 1].id;
      }
    }
  }

  /**
   * Crawl all users
   */
  async crawlAllUsers(batchSize: number = 1000): Promise<CrawledUser[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        verified: true,
        profileMediaId: true,
        followers: { select: { followerId: true } },
        followings: { select: { followingId: true } },
      },
      take: batchSize,
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      verified: user.verified,
      profileMediaId: user.profileMediaId,
      followersCount: user.followers.length,
      followingsCount: user.followings.length,
    }));
  }

  /**
   * Crawl users in batches
   */
  async *crawlUsersInBatches(
    batchSize: number = 1000
  ): AsyncGenerator<CrawledUser[], void, unknown> {
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const users: any = await this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          verified: true,
          profileMediaId: true,
          followers: { select: { followerId: true } },
          followings: { select: { followingId: true } },
        },
        take: batchSize,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      // ✅ FIXED: Direct map without destructuring
      yield users.map((user: any) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        verified: user.verified,
        profileMediaId: user.profileMediaId,
        followersCount: user.followers.length,
        followingsCount: user.followings.length,
      }));

      if (users.length < batchSize) {
        hasMore = false;
      } else {
        cursor = users[users.length - 1].id;
      }
    }
  }

  private tweetSelectFields() {
    return {
      id: true,
      content: true,
      createdAt: true,
      likesCount: true,
      retweetCount: true,
      repliesCount: true,
      quotesCount: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          verified: true,
          profileMediaId: true,
        },
      },
      tweetMedia: {
        select: {
          mediaId: true,
        },
      },
      hashtags: {
        select: {
          hash: {
            select: {
              tag_text: true,
            },
          },
        },
      },
    };
  }

  private transformTweets(tweets: any[]): CrawledTweet[] {
    return tweets.map((tweet) => ({
      id: tweet.id,
      content: tweet.content,
      createdAt: tweet.createdAt,
      likesCount: tweet.likesCount,
      retweetCount: tweet.retweetCount,
      repliesCount: tweet.repliesCount,
      quotesCount: tweet.quotesCount,
      userId: tweet.userId,
      user: tweet.user,
      mediaIds: tweet.tweetMedia.map((m: any) => m.mediaId),
      hashtags: tweet.hashtags.map((h: any) => h.hash.tag_text),
    }));
  }
}