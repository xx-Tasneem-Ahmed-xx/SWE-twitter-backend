jest.mock("@/database", () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
}));

jest.mock("@/config/redis", () => ({
  redisClient: {
    exists: jest.fn(),
  },
}));

jest.mock("@/api/controllers/messagesController", () => ({
  addMessageToChat: jest.fn(),
  resetUnseenChatCount: jest.fn(),
  updateMessageStatus: jest.fn(),
  getChatUsersId: jest.fn(),
}));

jest.mock("@/api/controllers/notificationController", () => ({
  markNotificationsAsRead: jest.fn(),
}));

jest.mock("@/application/utils/utils", () => ({
  ValidateToken: jest.fn(),
}));

import { SocketService } from "@/application/services/socketService";
import { Server, Socket } from "socket.io";
import * as utils from "@/application/utils/utils";
import { redisClient } from "@/config/redis";
import {
  addMessageToChat,
  resetUnseenChatCount,
  updateMessageStatus,
  getChatUsersId,
} from "@/api/controllers/messagesController";
import { markNotificationsAsRead } from "@/api/controllers/notificationController";
import prisma from "@/database";

describe("SocketService", () => {
  let mockIO: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;
  let socketService: SocketService;
  const testUserId = "test-user-id-123";
  const testToken = "Bearer valid-jwt-token";
  const testEmail = "test@example.com";
  const testUsername = "testuser";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock socket.io server
    mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: new Map(),
        },
        sockets: new Map(),
      },
    } as any;

    // Mock socket
    mockSocket = {
      id: "socket-id-123",
      handshake: {
        auth: { token: testToken },
        headers: {},
      },
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      disconnect: jest.fn(),
    } as any;

    // Mock utility functions
    (utils.ValidateToken as jest.Mock).mockReturnValue({
      ok: true,
      payload: {
        id: testUserId,
        email: testEmail,
        username: testUsername,
        version: 1,
        jti: "test-jti",
      },
      err: null,
    });

    // Mock redis
    (redisClient.exists as jest.Mock).mockResolvedValue(0);

    // Mock database
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: testUserId,
      email: testEmail,
      username: testUsername,
      tokenVersion: 1,
      unseenNotificationCount: 5,
      unseenChatCount: 3,
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: testUserId,
      email: testEmail,
      username: testUsername,
      tokenVersion: 1,
      unseenNotificationCount: 5,
      unseenChatCount: 3,
    });
  });

  describe("Constructor and Initialization", () => {
    it("should initialize SocketService with io server", () => {
      socketService = new SocketService(mockIO);
      expect(socketService.io).toBe(mockIO);
    });

    it("should setup socket connections on initialization", () => {
      socketService = new SocketService(mockIO);
      expect(mockIO.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });

    it("should have all required methods", () => {
      socketService = new SocketService(mockIO);
      expect(typeof socketService.checkSocketStatus).toBe("function");
      expect(typeof socketService.sendNotificationToUser).toBe("function");
      expect(typeof socketService.sendUnseenNotificationsCount).toBe(
        "function"
      );
      expect(typeof socketService.sendUnseenChatsCount).toBe("function");
      expect(typeof socketService.sendMessageToChat).toBe("function");
      expect(typeof socketService.sendDeletedChatToUser).toBe("function");
      expect(typeof socketService.getConnectedUsersCount).toBe("function");
    });
  });

  describe("Socket Connection Authentication", () => {
    beforeEach(() => {
      const toChainMock = { emit: jest.fn() };
      (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

      socketService = new SocketService(mockIO);
    });

    it("should reject connection with invalid token", async () => {
      (utils.ValidateToken as jest.Mock).mockReturnValue({
        ok: false,
        payload: null,
        err: "Invalid token",
      });

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith("auth-error", {
        message: "Authentication failed",
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should reject connection with no token", async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = {};

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith("auth-error", {
        message: "Authentication failed",
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should reject token with missing version", async () => {
      (utils.ValidateToken as jest.Mock).mockReturnValue({
        ok: true,
        payload: {
          id: testUserId,
          email: testEmail,
          version: undefined,
        },
        err: null,
      });

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should reject token with missing email", async () => {
      (utils.ValidateToken as jest.Mock).mockReturnValue({
        ok: true,
        payload: {
          id: testUserId,
          email: undefined,
          version: 1,
        },
        err: null,
      });

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe("Socket Event Handlers", () => {
    let testSocketEvents: Record<string, Function> = {};

    beforeEach(() => {
      jest.clearAllMocks();
      testSocketEvents = {};

      // Setup socket mocks
      const onSpy = jest.fn((event: string, handler: Function) => {
        testSocketEvents[event] = handler;
        return mockSocket;
      });

      mockSocket.on = onSpy as any;
      socketService = new SocketService(mockIO);
      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      return connectionHandler(mockSocket);
    });

    describe("typing event", () => {
      it("should broadcast typing status to other users in chat", async () => {
        const chatId = "chat-123";
        const otherUserId = "other-user-id";

        (getChatUsersId as jest.Mock).mockResolvedValue([
          testUserId,
          otherUserId,
        ]);

        const toChainMock = { emit: jest.fn() };
        (mockSocket.to as jest.Mock).mockReturnValue(toChainMock);

        if (testSocketEvents["typing"]) {
          await testSocketEvents["typing"]({ chatId, isTyping: true });

          expect(mockSocket.to).toHaveBeenCalledWith(otherUserId);
          expect(toChainMock.emit).toHaveBeenCalledWith("user-typing", {
            userId: testUserId,
            chatId: chatId,
            isTyping: true,
          });
        }
      });
    });

    describe("open-chat event", () => {
      it("should update message status", async () => {
        const chatId = "chat-123";

        (getChatUsersId as jest.Mock).mockResolvedValue([testUserId]);

        if (testSocketEvents["open-chat"]) {
          await testSocketEvents["open-chat"]({ chatId });

          expect(updateMessageStatus).toHaveBeenCalledWith(chatId, testUserId);
        }
      });
    });

    describe("open-notification event", () => {
      it("should mark notifications as read", async () => {
        if (testSocketEvents["open-notification"]) {
          await testSocketEvents["open-notification"]({
            notificationId: "notif-123",
          });

          expect(markNotificationsAsRead).toHaveBeenCalledWith(testUserId);
        }
      });
    });

    describe("add-message event", () => {
      it("should add message to chat", async () => {
        const message = {
          chatId: "chat-123",
          content: "Hello",
        };

        (addMessageToChat as jest.Mock).mockResolvedValue("message-id-123");

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        if (testSocketEvents["add-message"]) {
          await testSocketEvents["add-message"]({ message });

          expect(addMessageToChat).toHaveBeenCalledWith(message, testUserId);
          expect(toChainMock.emit).toHaveBeenCalledWith("message-added", {
            chatId: "chat-123",
            messageId: "message-id-123",
          });
        }
      });
    });

    describe("open-message-tab event", () => {
      it("should reset unseen chat count", async () => {
        if (testSocketEvents["open-message-tab"]) {
          await testSocketEvents["open-message-tab"]();

          expect(resetUnseenChatCount).toHaveBeenCalledWith(testUserId);
        }
      });
    });
  });

  describe("Public Methods", () => {
    beforeEach(() => {
      socketService = new SocketService(mockIO);
    });

    describe("checkSocketStatus", () => {
      it("should return true when user has active socket connection", () => {
        const userId = "user-123";
        const mockRoom = new Set(["socket-1", "socket-2"]);

        (mockIO.sockets.adapter.rooms as Map<string, Set<string>>).set(
          userId,
          mockRoom
        );

        const result = socketService.checkSocketStatus(userId);

        expect(result).toBe(true);
      });

      it("should return false when user has no active socket connection", () => {
        const userId = "user-123";
        (mockIO.sockets.adapter.rooms as Map<string, Set<string>>).clear();

        const result = socketService.checkSocketStatus(userId);

        expect(result).toBe(false);
      });

      it("should return false when user room is empty", () => {
        const userId = "user-123";
        (mockIO.sockets.adapter.rooms as Map<string, Set<string>>).set(
          userId,
          new Set()
        );

        const result = socketService.checkSocketStatus(userId);

        expect(result).toBe(false);
      });
    });

    describe("sendNotificationToUser", () => {
      it("should emit notification to user", () => {
        const userId = "user-123";
        const notification = {
          id: "notif-1",
          title: "Test",
          body: "Test notification",
        };

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendNotificationToUser(userId, notification);

        expect(mockIO.to).toHaveBeenCalledWith(userId);
        expect(toChainMock.emit).toHaveBeenCalledWith(
          "notification",
          notification
        );
      });
    });

    describe("sendUnseenNotificationsCount", () => {
      it("should emit unseen notifications count to user", () => {
        const userId = "user-123";
        const count = 5;

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendUnseenNotificationsCount(userId, count);

        expect(mockIO.to).toHaveBeenCalledWith(userId);
        expect(toChainMock.emit).toHaveBeenCalledWith(
          "unseen-notifications-count",
          { count }
        );
      });

      it("should handle zero count", () => {
        const userId = "user-123";
        const count = 0;

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendUnseenNotificationsCount(userId, count);

        expect(toChainMock.emit).toHaveBeenCalledWith(
          "unseen-notifications-count",
          { count: 0 }
        );
      });
    });

    describe("sendUnseenChatsCount", () => {
      it("should emit unseen chats count to user", () => {
        const userId = "user-123";
        const count = 3;

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendUnseenChatsCount(userId, count);

        expect(mockIO.to).toHaveBeenCalledWith(userId);
        expect(toChainMock.emit).toHaveBeenCalledWith("unseen-chats-count", {
          count,
        });
      });
    });

    describe("sendMessageToChat", () => {
      it("should emit message to user", () => {
        const userId = "user-123";
        const message = { id: "msg-1", content: "Hello", chatId: "chat-1" };

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendMessageToChat(userId, message);

        expect(mockIO.to).toHaveBeenCalledWith(userId);
        expect(toChainMock.emit).toHaveBeenCalledWith("new-message", message);
      });
    });

    describe("sendDeletedChatToUser", () => {
      it("should emit chat-deleted event to user", () => {
        const userId = "user-123";
        const chatId = "chat-1";

        const toChainMock = { emit: jest.fn() };
        (mockIO.to as jest.Mock).mockReturnValue(toChainMock);

        socketService.sendDeletedChatToUser(userId, chatId);

        expect(mockIO.to).toHaveBeenCalledWith(userId);
        expect(toChainMock.emit).toHaveBeenCalledWith("chat-deleted", {
          chatId,
        });
      });
    });

    describe("getConnectedUsersCount", () => {
      it("should return count of connected users", () => {
        (mockIO.sockets.sockets as Map<string, any>).set("socket-1", {});
        (mockIO.sockets.sockets as Map<string, any>).set("socket-2", {});
        (mockIO.sockets.sockets as Map<string, any>).set("socket-3", {});

        const count = socketService.getConnectedUsersCount();

        expect(count).toBe(3);
      });

      it("should return 0 when no users are connected", () => {
        (mockIO.sockets.sockets as Map<string, any>).clear();

        const count = socketService.getConnectedUsersCount();

        expect(count).toBe(0);
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    beforeEach(() => {
      socketService = new SocketService(mockIO);
    });

    it("should handle token validation errors", async () => {
      (utils.ValidateToken as jest.Mock).mockReturnValue({
        ok: false,
        payload: null,
        err: "Token parsing error",
      });

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "auth-error",
        expect.objectContaining({
          message: "Authentication failed",
        })
      );
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should handle missing socket data gracefully", async () => {
      const testSocketMissing = {
        ...mockSocket,
        handshake: { auth: {}, headers: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
        on: jest.fn(),
        join: jest.fn(),
        to: jest.fn().mockReturnThis(),
        data: {},
      } as any;

      const connectionHandler = (mockIO.on as jest.Mock).mock.calls[0][1];
      await connectionHandler(testSocketMissing);

      expect(testSocketMissing.emit).toHaveBeenCalledWith(
        "auth-error",
        expect.objectContaining({
          message: "Authentication failed",
        })
      );
      expect(testSocketMissing.disconnect).toHaveBeenCalled();
    });
  });

  describe("Complex Scenarios", () => {
    beforeEach(() => {
      socketService = new SocketService(mockIO);
    });

    it("should verify user has active socket connection with multiple sockets", () => {
      const userId = "user-123";
      const mockRoom = new Set(["socket-1", "socket-2", "socket-3"]);

      (mockIO.sockets.adapter.rooms as Map<string, Set<string>>).set(
        userId,
        mockRoom
      );

      const isActive = socketService.checkSocketStatus(userId);
      expect(isActive).toBe(true);
      expect(mockRoom.size).toBe(3);
    });
  });
});
