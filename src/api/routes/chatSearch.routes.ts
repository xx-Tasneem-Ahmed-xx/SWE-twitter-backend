// src/routes/chatSearch.routes.ts
import { Router, Request, Response } from "express";
import { ChatCrawler } from "@/chat/search/chatCrawler";
import { ChatParser } from "@/chat/search/chatParser";
import { ChatIndexer } from "@/chat/search/chatIndexer";
import { ChatSearchEngine, ChatSearchFilter } from "@/chat/search/chatSearchEngine";
import { ChatPersistenceManager } from "@/chat/search/chatPersistence";

export function chatSearchRoutes(
  chatCrawler: ChatCrawler,
  chatParser: ChatParser,
  chatIndexer: ChatIndexer,
  chatSearchEngine: ChatSearchEngine,
  chatPersistence: ChatPersistenceManager
) {
  const router = Router();

  /**
   * GET /api/chat/search?q=john&limit=20&filter=all&cursor=xxx
   * Search for users to chat with
   */
  router.get("/chat/search", async (req: Request, res: Response) => {
    try {
      const { q, cursor, filter } = req.query;
      const userId = (req as any).user?.id; // From auth middleware

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const query = (q as string) || "";
      const limit = parseInt(req.query.limit as string) || 20;
      const searchFilter = (filter as ChatSearchFilter) || ChatSearchFilter.ALL;

      // Decode cursor if provided
      let decodedCursor = undefined;
      if (cursor && typeof cursor === "string") {
        decodedCursor = chatSearchEngine.decodeCursor(cursor);
        if (!decodedCursor) {
          return res.status(400).json({
            success: false,
            message: "Invalid cursor",
          });
        }
      }

      const results = chatSearchEngine.searchChatUsers(
        query,
        limit,
        searchFilter,
        decodedCursor
      );

      return res.status(200).json({
        success: true,
        data: results.data.map(formatChatUser),
        cursor: results.cursor,
        total: results.total,
        query,
        filter: searchFilter,
      });
    } catch (error) {
      console.error("Chat search error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/chat/suggestions?limit=10
   * Get suggested users to chat with (mutual follows, followers, etc.)
   */
  router.get("/chat/suggestions", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const suggestions = chatSearchEngine.getSuggestedUsers(limit);

      return res.status(200).json({
        success: true,
        data: suggestions.map(formatChatUser),
      });
    } catch (error) {
      console.error("Chat suggestions error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/chat/recent?limit=20
   * Get recent chat users (with existing DM conversations)
   */
  router.get("/chat/recent", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;

      // Get user IDs from recent DM chats
      const recentChats = await chatCrawler["prisma"].chat.findMany({
        where: {
          DMChat: true,
          chatUsers: {
            some: { userId },
          },
        },
        select: {
          chatUsers: {
            where: { userId: { not: userId } },
            select: { userId: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      const userIds = recentChats
        .map((chat) => chat.chatUsers[0]?.userId)
        .filter((id) => id != null);

      const recentUsers = chatSearchEngine.getRecentChatUsers(userIds, limit);

      return res.status(200).json({
        success: true,
        data: recentUsers.map(formatChatUser),
      });
    } catch (error) {
      console.error("Recent chats error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/chat/user/:id
   * Get a specific chat user by ID
   */
  router.get("/chat/user/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = chatIndexer.getChatUser(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found in chat index",
        });
      }

      return res.status(200).json({
        success: true,
        data: formatChatUser(user),
      });
    } catch (error) {
      console.error("Get chat user error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * GET /api/chat/search/stats
   * Get chat search index statistics
   */
  router.get("/chat/search/stats", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const stats = chatSearchEngine.getStats();
      const metadata = await chatPersistence.getChatIndexMetadata(
        `chat_search_index:${userId}`
      );

      return res.status(200).json({
        success: true,
        data: {
          ...stats,
          metadata,
        },
      });
    } catch (error) {
      console.error("Get chat stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  /**
   * POST /api/chat/search/reindex
   * Manually trigger a full reindex of chat search
   */
  router.post("/chat/search/reindex", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Start reindexing in background
      reindexChatInBackground(
        userId,
        chatCrawler,
        chatParser,
        chatIndexer,
        chatSearchEngine
      );

      return res.status(202).json({
        success: true,
        message: "Chat reindexing started in background",
      });
    } catch (error) {
      console.error("Chat reindex error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  return router;
}

/**
 * Helper: Reindex chat search in background
 */
async function reindexChatInBackground(
  userId: string,
  chatCrawler: ChatCrawler,
  chatParser: ChatParser,
  chatIndexer: ChatIndexer,
  chatSearchEngine: ChatSearchEngine
) {
  console.log(`🔄 Starting chat reindex for user ${userId}...`);
  const startTime = Date.now();

  try {
    chatIndexer.clear();

    // Get unread counts first
    const allUserIds: string[] = [];
    for await (const batch of chatCrawler.crawlChatUsersInBatches(userId, 1000)) {
      allUserIds.push(...batch.map(u => u.id));
    }

    const unreadCounts = await chatCrawler.getUnreadCounts(userId, allUserIds);

    // Index users in batches
    let userCount = 0;
    chatIndexer.clear(); // Clear again before indexing

    for await (const batch of chatCrawler.crawlChatUsersInBatches(userId, 1000)) {
      const parsed = batch.map((u) => {
        const hasUnread = unreadCounts.get(u.id) ? true : false;
        return chatParser.parseChatUser(u, hasUnread);
      });
      chatIndexer.indexChatUsers(parsed);
      userCount += batch.length;
      console.log(`Indexed ${userCount} chat users...`);
    }

    // Save to Redis
    await chatSearchEngine.saveIndex(`chat_search_index:${userId}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Chat reindex complete for ${userId} in ${duration}s: ${userCount} users`
    );
  } catch (error) {
    console.error(`❌ Chat reindex failed for ${userId}:`, error);
  }
}

/**
 * Format chat user for API response
 */
function formatChatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    verified: user.verified,
    profileMediaId: user.profileMediaId,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    isFollowing: user.isFollowing,
    isFollowedBy: user.isFollowedBy,
    mutualFollowers: user.mutualFollowers,
    hasUnreadMessages: user.hasUnreadMessages,
    score: user.score,
  };
}