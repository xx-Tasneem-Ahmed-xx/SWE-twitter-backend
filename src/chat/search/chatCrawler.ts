// src/chat/search/chatCrawler.ts
import { PrismaClient } from "@prisma/client";

export interface CrawledChatUser {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  verified: boolean;
  profileMediaId: string | null;
  followersCount: number;
  followingsCount: number;
  // Chat-specific fields
  mutualFollowers: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
}

export class ChatCrawler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Crawl all users for chat search (excluding current user and blocked users)
   */
  async crawlAllChatUsers(
    currentUserId: string,
    batchSize: number = 1000
  ): Promise<CrawledChatUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Exclude self
          { blocked: { none: { blockerId: currentUserId } } }, // Not blocked by current user
          { blockers: { none: { blockedId: currentUserId } } }, // Hasn't blocked current user
        ],
      },
      select: this.userSelectFields(),
      take: batchSize,
      orderBy: { joinDate: "desc" },
    });

    return this.transformUsers(users, currentUserId);
  }

  /**
   * Crawl users in batches with cursor pagination
   */
  async *crawlChatUsersInBatches(
    currentUserId: string,
    batchSize: number = 1000
  ): AsyncGenerator<CrawledChatUser[], void, unknown> {
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const users: any = await this.prisma.user.findMany({
        where: {
          AND: [
            { id: { not: currentUserId } },
            { blocked: { none: { blockerId: currentUserId } } },
            { blockers: { none: { blockedId: currentUserId } } },
          ],
        },
        select: this.userSelectFields(),
        take: batchSize,
        orderBy: { joinDate: "desc" },
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      yield this.transformUsers(users, currentUserId);

      if (users.length < batchSize) {
        hasMore = false;
      } else {
        cursor = users[users.length - 1].id;
      }
    }
  }

  /**
   * Crawl users that current user follows (for priority in search)
   */
  async crawlFollowingUsers(currentUserId: string): Promise<CrawledChatUser[]> {
    const followingRecords = await this.prisma.follow.findMany({
      where: { 
        followerId: currentUserId,
        status: "ACCEPTED" as const
      },
      include: {
        following: {
          select: this.userSelectFields(),
        },
      },
    });

    const users = followingRecords.map((record) => record.following);
    return this.transformUsers(users, currentUserId);
  }

  /**
   * Crawl users that follow current user (for mutual connection detection)
   */
  async crawlFollowerUsers(currentUserId: string): Promise<CrawledChatUser[]> {
    const followerRecords = await this.prisma.follow.findMany({
      where: { 
        followingId: currentUserId,
        status: "ACCEPTED" as const
      },
      include: {
        follower: {
          select: this.userSelectFields(),
        },
      },
    });

    const users = followerRecords.map((record) => record.follower);
    return this.transformUsers(users, currentUserId);
  }

  /**
   * Crawl users with recent chat activity
   */
  async crawlRecentChatUsers(
    currentUserId: string,
    limit: number = 50
  ): Promise<CrawledChatUser[]> {
    // Get users from recent chats (DM only)
    const recentChats = await this.prisma.chat.findMany({
      where: {
        DMChat: true,
        chatUsers: {
          some: { userId: currentUserId },
        },
      },
      select: {
        id: true,
        updatedAt: true,
        chatUsers: {
          where: {
            userId: { not: currentUserId },
          },
          select: {
            user: {
              select: this.userSelectFields(),
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const users = recentChats
      .map((chat) => chat.chatUsers[0]?.user)
      .filter((user) => user != null);

    return this.transformUsers(users, currentUserId);
  }

  private userSelectFields() {
    return {
      id: true,
      name: true,
      username: true,
      bio: true,
      verified: true,
      profileMediaId: true,
      followers: {
        where: { status: { equals: "ACCEPTED" as const } },
        select: { followerId: true },
      },
      followings: {
        where: { status: { equals: "ACCEPTED" as const } },
        select: { followingId: true },
      },
    } as const;
  }

  private transformUsers(users: any[], currentUserId: string): CrawledChatUser[] {
    return users.map((user) => {
      // Check if current user follows this user
      const isFollowing = user.followings?.some(
        (f: any) => f.followingId === currentUserId
      ) || false;
      
      // Check if this user follows current user
      const isFollowedBy = user.followers?.some(
        (f: any) => f.followerId === currentUserId
      ) || false;

      // Calculate mutual followers
      const mutualFollowers = isFollowing && isFollowedBy ? 1 : 0;

      // Count total followers/followings (accepted only)
      const followersCount = Array.isArray(user.followers) 
        ? user.followers.length 
        : 0;
      const followingsCount = Array.isArray(user.followings) 
        ? user.followings.length 
        : 0;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        verified: user.verified,
        profileMediaId: user.profileMediaId,
        followersCount,
        followingsCount,
        mutualFollowers,
        isFollowing,
        isFollowedBy,
      };
    });
  }

  /**
   * Get unread message counts for users (from DM chats)
   */
  async getUnreadCounts(
    userId: string,
    userIds: string[]
  ): Promise<Map<string, number>> {
    // Get all DM chats involving the current user
    const chats = await this.prisma.chat.findMany({
      where: {
        DMChat: true,
        chatUsers: {
          some: { userId },
        },
      },
      select: {
        id: true,
        chatUsers: {
          where: { userId: { not: userId } },
          select: { userId: true },
        },
      },
    });

    const countMap = new Map<string, number>();

    // For each chat, count unread messages
    for (const chat of chats) {
      const otherUserId = chat.chatUsers[0]?.userId;
      if (!otherUserId || !userIds.includes(otherUserId)) continue;

      const unreadCount = await this.prisma.message.count({
        where: {
          chatId: chat.id,
          userId: otherUserId, // Messages sent by the other user
          status: { in: ["SENT", "PENDING"] }, // Not READ
        },
      });

      if (unreadCount > 0) {
        countMap.set(otherUserId, unreadCount);
      }
    }

    return countMap;
  }
}