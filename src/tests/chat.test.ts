jest.mock("@/app", () => {
  return {
    socketService: {
      sendMessageToChat: jest.fn(),
      checkSocketStatus: jest.fn(() => false),
      sendUnseenChatsCount: jest.fn(),
      sendDeletedChatToUser: jest.fn(),
    },
  };
});

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import * as chatService from "../api/controllers/messagesController";
import { newMessageInput } from "@/application/dtos/chat/messages.dto";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("Chat Service Tests", () => {
  const testUserIds = ["user123", "user456", "user789", "user999"];

  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running tests with real database connection");

    // Create test users
    for (let i = 0; i < testUserIds.length; i++) {
      await prisma.user.upsert({
        where: { username: `test_user${i}` },
        update: {},
        create: {
          username: `test_user${i}`,
          id: testUserIds[i],
          email: `test_user${i}@example.com`,
          password: `password${i}`,
          saltPassword: `salt${i}`,
          dateOfBirth: new Date("2000-01-01"),
          name: `Test User ${i}`,
          bio: `I am test user ${i}`,
          verified: true,
          protectedAccount: false,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.fcmToken.deleteMany();
    await prisma.chatGroup.deleteMany();
    await prisma.messageMedia.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chatUser.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.fcmToken.deleteMany();
    await prisma.chatGroup.deleteMany();
    await prisma.messageMedia.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chatUser.deleteMany();
    await prisma.chat.deleteMany();
  });

  describe("Create Chat Tests", () => {
    it("should create a new direct message chat between two users", async () => {
      const res = mockRes();
      const req: any = {
        body: { DMChat: true, participant_ids: ["user456"] },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.createChat(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const createdChat = res.json.mock.calls[0][0];
      expect(createdChat.newChat).not.toBeNull();
      expect(createdChat.newChat.DMChat).toBe(true);
      expect(createdChat.newChat.chatUsers).toHaveLength(2);
    });



    it("should return existing DM chat if already exists", async () => {
      const res1 = mockRes();
      const req1: any = {
        body: { DMChat: true, participant_ids: ["user456"] },
        user: { id: "user123" },
      };
      const next1 = jest.fn();

      await chatService.createChat(req1, res1, next1);
      const firstChat = res1.json.mock.calls[0][0].newChat.id;

      const res2 = mockRes();
      const req2: any = {
        body: { DMChat: true, participant_ids: ["user456"] },
        user: { id: "user123" },
      };
      const next2 = jest.fn();

      await chatService.createChat(req2, res2, next2);
      const secondChat = res2.json.mock.calls[0][0].newChat.id;

      expect(firstChat).toBe(secondChat);
      expect(res2.status).toHaveBeenCalledWith(200);
    });



    it("should fail when participant IDs are empty", async () => {
      const res = mockRes();
      const req: any = {
        body: { DMChat: true, participant_ids: [] },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.createChat(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should fail when DMChat is undefined", async () => {
      const res = mockRes();
      const req: any = {
        body: { DMChat: undefined, participant_ids: ["user456"] },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.createChat(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should fail when participant does not exist", async () => {
      const res = mockRes();
      const req: any = {
        body: { DMChat: true, participant_ids: ["nonexistent_user"] },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.createChat(req, res, next);

      expect(next).toHaveBeenCalled();
    });


  });

  describe("Add Message to Chat Tests", () => {
    it("should add a message to an existing chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const messageInput: newMessageInput = {
        data: { content: "Hello, this is a test message!" },
        chatId: (chat as any).id,
        recipientId: [],
        createdAt: new Date(),
      };

      const messageId = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe("string");

      const message = await prisma.message.findUnique({
        where: { id: messageId as string },
      });
      expect(message).toBeDefined();
      expect(message?.content).toBe("Hello, this is a test message!");
      expect(message?.userId).toBe("user123");
      expect(message?.status).toBe("SENT");
    });

    it("should create a new DM chat if only recipientId is provided", async () => {
      const messageInput: newMessageInput = {
        data: { content: "Test message" },
        recipientId: ["user456"],
        createdAt: new Date(),
      };

      const messageId = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(messageId).toBeDefined();
      const message = await prisma.message.findUnique({
        where: { id: messageId as string },
      });
      expect(message).toBeDefined();
      expect(message?.chatId).toBeDefined();

      const chat = await prisma.chat.findUnique({
        where: { id: message?.chatId },
      });
      expect(chat?.DMChat).toBe(true);
    });

    it("should fail when message content is missing", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const messageInput: newMessageInput = {
        data: {},
        chatId: (chat as any).id,
        recipientId: [],
        createdAt: new Date(),
      };

      const result = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(result).toBeInstanceOf(Error);
    });

    it("should fail when both chatId and recipientId are missing", async () => {
      const messageInput: newMessageInput = {
        data: { content: "Test" },
        recipientId: [],
        createdAt: new Date(),
      };

      const result = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(result).toBeInstanceOf(Error);
    });

    it("should fail when invalid chat ID is provided", async () => {
      const messageInput: newMessageInput = {
        data: { content: "Test" },
        chatId: "invalid-chat-id",
        recipientId: [],
        createdAt: new Date(),
      };

      const result = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(result).toBeInstanceOf(Error);
    });


  });

  describe("Get Chat Info Tests", () => {
    it("should retrieve chat information successfully", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const res = mockRes();
      const req: any = {
        params: { chatId: (chat as any).id },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getChatInfo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const retrievedChat = res.json.mock.calls[0][0];
      expect(retrievedChat.id).toBe((chat as any).id);
      expect(retrievedChat.chatUsers).toHaveLength(2);
      expect(retrievedChat.messages).toBeDefined();
    });

    it("should return error for non-existent chat", async () => {
      const res = mockRes();
      const req: any = {
        params: { chatId: "nonexistent-chat-id" },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getChatInfo(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return error when chatId is missing", async () => {
      const res = mockRes();
      const req: any = {
        params: {},
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getChatInfo(req, res, next);

      expect(next).toHaveBeenCalled();
    });


  });

  describe("Get Chat Messages Tests", () => {
    it("should retrieve chat messages with pagination", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      // Add some messages
      await prisma.message.create({
        data: {
          chatId: (chat as any).id,
          userId: "user123",
          content: "Message 1",
          status: "SENT",
        },
      });

      const res = mockRes();
      const req: any = {
        params: { chatId: (chat as any).id },
        query: { lastMessageTimestamp: new Date().toISOString() },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getChatMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const messages = res.json.mock.calls[0][0];
      expect(Array.isArray(messages)).toBe(true);
    });

    it("should return error when chatId is missing", async () => {
      const res = mockRes();
      const req: any = {
        params: {},
        query: { lastMessageTimestamp: new Date().toISOString() },
      };
      const next = jest.fn();

      await chatService.getChatMessages(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return error when lastMessageTimestamp is missing", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const res = mockRes();
      const req: any = {
        params: { chatId: (chat as any).id },
        query: {},
      };
      const next = jest.fn();

      await chatService.getChatMessages(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return error for non-existent chat", async () => {
      const res = mockRes();
      const req: any = {
        params: { chatId: "nonexistent-id" },
        query: { lastMessageTimestamp: new Date().toISOString() },
      };
      const next = jest.fn();

      await chatService.getChatMessages(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Get User Chats Tests", () => {
    it("should retrieve all chats for a user", async () => {
      await chatService.CreateChatFun(true, ["user123", "user456"]);
      await chatService.CreateChatFun(false, ["user123", "user456", "user789"]);

      const res = mockRes();
      const req: any = { user: { id: "user123" } };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const chats = res.json.mock.calls[0][0];
      expect(Array.isArray(chats)).toBe(true);
      expect(chats.length).toBe(2);
    });

    it("should include unseen messages count for each chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      // Add unread messages
      await prisma.message.create({
        data: {
          chatId: (chat as any).id,
          userId: "user456",
          content: "Unread message",
          status: "SENT",
        },
      });

      const res = mockRes();
      const req: any = { user: { id: "user123" } };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      const chats = res.json.mock.calls[0][0];
      expect(chats[0]).toHaveProperty("unseenMessagesCount");
      expect(chats[0].unseenMessagesCount).toBeGreaterThanOrEqual(0);
    });

    it("should return error when user ID is missing", async () => {
      const res = mockRes();
      const req: any = { user: {} };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return empty array when user has no chats", async () => {
      const res = mockRes();
      const req: any = { user: { id: "user999" } };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const chats = res.json.mock.calls[0][0];
      expect(Array.isArray(chats)).toBe(true);
      expect(chats.length).toBe(0);
    });

    it("should include latest message in each chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      await prisma.message.create({
        data: {
          chatId: (chat as any).id,
          userId: "user123",
          content: "Latest message",
          status: "SENT",
        },
      });

      const res = mockRes();
      const req: any = { user: { id: "user123" } };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      const chats = res.json.mock.calls[0][0];
      expect(chats[0].messages).toHaveLength(1);
      expect(chats[0].messages[0].content).toBe("Latest message");
    });
  });

  describe("Delete Chat Tests", () => {
    it("should delete chat successfully", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      const res = mockRes();
      const req: any = {
        params: { chatId },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.deleteChat(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      const deletedChat = await prisma.chat.findUnique({
        where: { id: chatId },
      });
      expect(deletedChat).toBeNull();
    });

    it("should delete all messages in chat when deleting chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      await prisma.message.create({
        data: {
          chatId,
          userId: "user123",
          content: "Test message",
          status: "SENT",
        },
      });

      const res = mockRes();
      const req: any = {
        params: { chatId },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.deleteChat(req, res, next);

      const messages = await prisma.message.findMany({
        where: { chatId },
      });
      expect(messages).toHaveLength(0);
    });

    it("should return error when chatId is missing", async () => {
      const res = mockRes();
      const req: any = {
        params: {},
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.deleteChat(req, res, next);

      expect(next).toHaveBeenCalled();
    });


  });



  describe("Message Status Tests", () => {
    it("should update message status to READ", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      await prisma.message.create({
        data: {
          chatId,
          userId: "user456",
          content: "Test message",
          status: "SENT",
        },
      });

      const result = await chatService.updateMessageStatus(chatId, "user123");

      expect(result).toBe(true);

      const messages = await prisma.message.findMany({
        where: { chatId, userId: "user456", status: "READ" },
      });
      expect(messages.length).toBeGreaterThan(0);
    });

    it("should not update own messages to READ", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      const message = await prisma.message.create({
        data: {
          chatId,
          userId: "user123",
          content: "My message",
          status: "SENT",
        },
      });

      await chatService.updateMessageStatus(chatId, "user123");

      const updatedMessage = await prisma.message.findUnique({
        where: { id: message.id },
      });
      expect(updatedMessage?.status).toBe("SENT");
    });

    it("should handle chat with no unseen messages", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      const result = await chatService.updateMessageStatus(chatId, "user123");

      expect(result).toBe(true);
    });
  });

  describe("Get Unseen Messages Count Tests", () => {
    it("should return unseen messages count for a specific chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      await prisma.message.createMany({
        data: [
          {
            chatId,
            userId: "user456",
            content: "Message 1",
            status: "SENT",
          },
          {
            chatId,
            userId: "user456",
            content: "Message 2",
            status: "SENT",
          },
        ],
      });

      const res = mockRes();
      const req: any = {
        params: { chatId },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getUnseenMessagesCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const result = res.json.mock.calls[0][0];
      expect(result.unseenMessagesCount).toBe(2);
    });

    it("should return error when chatId is missing", async () => {
      const res = mockRes();
      const req: any = {
        params: {},
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getUnseenMessagesCount(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return 0 when all messages are read", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      await prisma.message.create({
        data: {
          chatId,
          userId: "user456",
          content: "Message",
          status: "READ",
        },
      });

      const res = mockRes();
      const req: any = {
        params: { chatId },
        user: { id: "user123" },
      };
      const next = jest.fn();

      await chatService.getUnseenMessagesCount(req, res, next);

      const result = res.json.mock.calls[0][0];
      expect(result.unseenMessagesCount).toBe(0);
    });
  });

  describe("Get Unseen Messages Count Of User Tests", () => {
    it("should return total unseen messages count for user", async () => {
      const chat1 = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chat2 = await chatService.CreateChatFun(true, [
        "user123",
        "user789",
      ]);

      await prisma.message.createMany({
        data: [
          {
            chatId: (chat1 as any).id,
            userId: "user456",
            content: "Message 1",
            status: "SENT",
          },
          {
            chatId: (chat2 as any).id,
            userId: "user789",
            content: "Message 2",
            status: "SENT",
          },
          {
            chatId: (chat2 as any).id,
            userId: "user789",
            content: "Message 3",
            status: "SENT",
          },
        ],
      });

      const res = mockRes();
      const req: any = { user: { id: "user123" } };
      const next = jest.fn();

      await chatService.getUnseenMessagesCountOfUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const result = res.json.mock.calls[0][0];
      expect(result.totalUnseenMessages).toBe(3);
    });

    it("should return error when user ID is missing", async () => {
      const res = mockRes();
      const req: any = { user: {} };
      const next = jest.fn();

      await chatService.getUnseenMessagesCountOfUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Get Chat Users ID Tests", () => {
    it("should return all user IDs in a chat", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      const userIds = await chatService.getChatUsersId((chat as any).id);

      expect(userIds).toHaveLength(2);
      expect(userIds).toContain("user123");
      expect(userIds).toContain("user456");
    });

    it("should return empty array for non-existent chat", async () => {
      const userIds = await chatService.getChatUsersId("nonexistent-id");

      expect(userIds).toEqual([]);
    });
  });

  describe("Create Chat Function Tests", () => {
    it("should create DM chat with two participants", async () => {
      const chat = await chatService.CreateChatFun(true, ["user123", "user456"]);

      expect(chat).toBeDefined();
      expect((chat as any).DMChat).toBe(true);
      expect((chat as any).chatUsers).toHaveLength(2);
    });




  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent message creation", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          chatService.addMessageToChat(
            {
              data: { content: `Concurrent message ${i}` },
              chatId,
              createdAt: new Date(),
            },
            "user123"
          )
        );

      const results = await Promise.all(promises);

      expect(results.filter((r) => typeof r === "string")).toHaveLength(5);
    });

    it("should handle messages with empty string content", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      const messageInput: newMessageInput = {
        data: { content: "" },
        chatId: (chat as any).id,
        createdAt: new Date(),
      };

      const result = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle special characters in messages", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);

      const messageInput: newMessageInput = {
        data: { content: '{"special": "chars", "emoji": "😀", "quote": "\\"test\\""}' },
        chatId: (chat as any).id,
        createdAt: new Date(),
      };

      const messageId = await chatService.addMessageToChat(
        messageInput,
        "user123"
      );

      const message = await prisma.message.findUnique({
        where: { id: messageId as string },
      });
      expect(message?.content).toContain("special");
    });

    it("should handle large batch of messages", async () => {
      const chat = await chatService.CreateChatFun(true, [
        "user123",
        "user456",
      ]);
      const chatId = (chat as any).id;

      for (let i = 0; i < 50; i++) {
        await prisma.message.create({
          data: {
            chatId,
            userId: i % 2 === 0 ? "user123" : "user456",
            content: `Message ${i}`,
            status: "SENT",
          },
        });
      }

      const res = mockRes();
      const req: any = {
        params: { chatId },
        query: { lastMessageTimestamp: new Date().toISOString() },
      };
      const next = jest.fn();

      await chatService.getChatMessages(req, res, next);

      const messages = res.json.mock.calls[0][0];
      expect(messages.length).toBeLessThanOrEqual(50);
    });

    it("should handle user that is participant in many chats", async () => {
      const users = ["user456", "user789", "user999"];

      // Create 3 unique DM chats (deduplication prevents more with same users)
      for (let i = 0; i < 3; i++) {
        await chatService.CreateChatFun(true, ["user123", users[i]]);
      }

      const res = mockRes();
      const req: any = { user: { id: "user123" } };
      const next = jest.fn();

      await chatService.getUserChats(req, res, next);

      const chats = res.json.mock.calls[0][0];
      expect(chats.length).toBeGreaterThanOrEqual(3);
    });
  });
});
