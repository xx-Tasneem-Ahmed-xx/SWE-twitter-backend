jest.mock("@/app", () => {
  return {
    socketService: {
      sendMessageToChat: jest.fn(),
    },
  };
});

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import * as chatService from "../api/controllers/messagesController";
import { body, param } from "express-validator";
import { newMessageInput } from "@/application/dtos/chat/messages.dto";
import { log } from "node:console";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("chat service", () => {
    beforeAll(async () => {
        await connectToDatabase();
        console.log("Running tests with real database connection");
        await prisma.user.upsert({
            where: { username: "test_user1" },
            update: {},
            create: {
                username: "test_user1",
                id: "123",
                email: "test_user1@example.com",
                password: "password123",
                saltPassword: "salt123",
                dateOfBirth: new Date("2025-11-21"),
                name: "Test User One",
                //profileMediaId: "media1",
                bio: "I am test user one",
                verified: true,
                protectedAccount: false,
            },
        });
        await prisma.user.upsert({
            where: { username: "test_user2" },
            update: {},
            create: {
                username: "test_user2",
                id: "456",
                email: "test_user2@example.com",
                password: "password456",
                saltPassword: "salt456",
                dateOfBirth: new Date("2025-10-21"),
                name: "Test User Two",
                //profileMediaId: "media2",
                bio: "I am test user two",
                verified: true,
                protectedAccount: false,
            },
        });
        await prisma.user.upsert({
            where: { username: "test_user3" },
            update: {},
            create: {
                username: "test_user3",
                id: "789",
                email: "test_user3@example.com",
                password: "password456",
                saltPassword: "salt456",
                dateOfBirth: new Date("2025-10-21"),
                name: "Test User Three",
                //profileMediaId: "media2",
                bio: "I am test user three",
                verified: true,
                protectedAccount: false,
            },
        });

    });

    afterAll(async () => {
        await prisma.chatGroup.deleteMany();
        await prisma.message.deleteMany();
        await prisma.chatUser.deleteMany();
        await prisma.chat.deleteMany();
        await prisma.user.deleteMany({
            where: { id: { in: ["123", "456", "789"] } },
        });
        await prisma.$disconnect();
    });

    beforeEach(async () => {
         await prisma.chatGroup.deleteMany();
        await prisma.message.deleteMany();
        await prisma.chatUser.deleteMany();
        await prisma.chat.deleteMany();
    });

    describe("create new chat (dm - group)", () => {
        it("should create a new direct message chat between two users", async () => {
            const res = mockRes();
            const req: any = {body: {DMChat: true, participant_ids: ["456"]}, user: { id: "123" } };
            const next = jest.fn();
            await chatService.createChat(req, res, next);
            const createdChat = res.json.mock.calls[0][0];
            expect(res.status).toHaveBeenCalledWith(201);
            expect(createdChat).not.toBeNull();
            expect(createdChat.newChat.DMChat).toBe(true);
        });

        it("should create a new group chat with multiple users", async () => {
            const res = mockRes();
            const req: any = {body: {DMChat: false, participant_ids: ["456", "789"]}, user: { id: "123" } };
            const next = jest.fn();
            await chatService.createChat(req, res, next);
            const createdChat = res.json.mock.calls[0][0];
            expect(res.status).toHaveBeenCalledWith(201);
            expect(createdChat).not.toBeNull();
            expect(createdChat.newChat.DMChat).toBe(false);
        });

//         it("it should fail to create a group chat with less than three users", async () => {
//             const res = mockRes();
//             const req: any = {body: {DMChat: false, participant_ids: ["456"]}, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.createChat(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'At least two participants are required to create a chat' });
//         });

//         it("it should fail to create a chat with empty participant list", async () => {
//             const res = mockRes();
//             const req: any = {body: {DMChat: true, participant_ids: []}, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.createChat(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Participant IDs are required' });
//         });
    });

//     describe("send a new message", () => {

//         it("send a message without a chat ID should create a new chat", async () => {
//             const messageInput = {
//                 data: {
//                     content: "Hello, this is a test message!"
//                 },
//                 chatId: "",
//                 recipientId: ["456"]
//             } as newMessageInput;
//             const res = mockRes();
//             const next = jest.fn();
//             const req = {body : messageInput, user: { id: "123" } } as any;
//             await chatService.addMessageToChat(req, res);
//             const message = res.json.mock.calls[0][0];
//             const chat = await prisma.chat.findFirst({
//                 where: { id: message.chatId }
//             }) as any;
//             expect(res.status).toHaveBeenCalledWith(201);
//             expect(chat).not.toBeNull();
//             expect(chat).toHaveProperty("id");
//             expect(chat.id).toBe(message.newMessage.chatId);
//             expect(message.newMessage.content).toBe("Hello, this is a test message!");
//             expect(message.newMessage.userId).toBe("123");
//         });

//         it("send a message with an existing chat ID does not need to get participantsID", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;

//             const messageInput = {
//                 data: {
//                     content: "Hello, this is a test message!"
//                 },
//                 chatId: chat.id,
//                 recipientId: []
//             } as newMessageInput;
//             const res = mockRes();
//             const next = jest.fn();
//             const req = {body : messageInput, user: { id: "123" } } as any;
//             await chatService.addMessageToChat(req, res);
//             const message = res.json.mock.calls[0][0];
//             expect(res.status).toHaveBeenCalledWith(201);
//             expect(chat).not.toBeNull();
//             expect(chat.id).toBe(message.newMessage.chatId);
//             expect(message.newMessage.content).toBe("Hello, this is a test message!");
//             expect(message.newMessage.userId).toBe("123");
//         });

//         it("send a message with invalid chat ID should return 404", async () => {
//             const messageInput = {
//                 data: {
//                     content: "Hello, this is a test message!"
//                 },
//                 chatId: "nonexistent-chat-id",
//                 recipientId: []
//             } as newMessageInput;
//             const res = mockRes();
//             const next = jest.fn();
//             const req = {body : messageInput, user: { id: "123" } } as any;
//             await chatService.addMessageToChat(req, res);
//             expect(res.status).toHaveBeenCalledWith(404);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat not found' });
//         });

//         it("send a message without chat ID and without recipient IDs should return 400", async () => {
//             const messageInput = {
//                 data: {
//                     content: "Hello, this is a test message!"
//                 },
//                 chatId: "",
//                 recipientId: []
//             } as newMessageInput;
//             const res = mockRes();
//             const next = jest.fn();
//             const req = {body : messageInput, user: { id: "123" } } as any;
//             await chatService.addMessageToChat(req, res);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'missing chatId or recipientId' });
//         });

//         it("send message without content should return 400", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             const messageInput = {
//                 data: {},
//                 chatId: chat.id,
//                 recipientId: []
//             } as newMessageInput;
//             const res = mockRes();
//             const next = jest.fn();
//             const req = {body : messageInput, user: { id: "123" } } as any;
//             await chatService.addMessageToChat(req, res);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Message content is required' });
//         });

//     });

//     describe("get chat info", () => {
//         it("should retrieve chat information successfully", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             const res = mockRes();
//             const req: any = { params: { chatId: chat.id }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatInfo(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(200);
//             const retrievedChat = res.json.mock.calls[0][0];
//             expect(retrievedChat).not.toBeNull();
//             expect(retrievedChat).toHaveProperty("id", chat.id);
//             expect(retrievedChat).toHaveProperty("DMChat", chat.DMChat);
//             expect(retrievedChat.chatUsers.length).toBe(2);
//         });

//         it("should return 404 for non-existent chat", async () => {
//             const res = mockRes();
//             const req: any = { params: { chatId: "nonexistent-chat-id" }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatInfo(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(404);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat not found' });
//         });

//         it("should return 400 for missing chat ID", async () => {
//             const res = mockRes();
//             const req: any = { params: { }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatInfo(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID is required' });
//         });
//     });

//     describe("get chat messages", () => {
//         it("should retrieve chat messages successfully", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             const res = mockRes();

//             const req: any = { body: { chatId: chat.id, lastMessagetimestamp: new Date() }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatMessages(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(200);
//             const messages = res.json.mock.calls[0][0];
//             expect(Array.isArray(messages)).toBe(true);
//             expect(messages.length).toBe(0);
//         });

//         it("should return 404 for non-existent chat when retrieving messages", async () => {
//             const res = mockRes();
//             const req: any = { body: { chatId: "nonexistent-chat-id", lastMessagetimestamp: new Date() }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatMessages(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(404);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat not found' });
//         });

//         it("should return 400 for missing chat ID when retrieving messages", async () => {
//             const res = mockRes();
//             const req: any = { body: { lastMessagetimestamp: new Date() }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatMessages(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID and lastMessage timestamp are required' });
//         });

//         it("should return 400 for missing last message timestamp when retrieving messages", async () => {
//             const res = mockRes();
//             const req: any = { body: { chatId: "some-chat-id" }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getChatMessages(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID and lastMessage timestamp are required' });
//         });
//     });

//     describe("delete chat", () => {
//         it("should delete chat successfully", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             const res = mockRes();
//             const req: any = { params: { chatId: chat.id }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.deleteChat(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(200);
//             expect(res.json).toHaveBeenCalledWith({ message: 'Chat deleted successfully' });
//         });

//         it("should return 400 for missing chat ID when deleting chat", async () => {
//             const res = mockRes();
//             const req: any = { params: { }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.deleteChat(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID is required' });
//         });
//     });

//     describe("get user chats", () => {
//         it("should retrieve all chats for a user", async () => {
//             await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             await chatService.CreateChatFun(false, ["123", "789", "456"]) as any;
//             const res = mockRes();
//             const req: any = { user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.getUserChats(req, res, next);
//             const chats = res.json.mock.calls[0][0];
//             expect(res.status).toHaveBeenCalledWith(200);
//             expect(Array.isArray(chats)).toBe(true);
//             expect(chats.length).toBe(2);
//         });
//     });

//     describe("update chat information", () => {
//         it("should update chat information successfully", async () => {
//             const chat = await chatService.CreateChatFun(false, ["123", "456", "789"]) as any;
//             const res = mockRes();
//             const req: any = { params: { chatId: chat.id }, body: { name: "Updated Chat Name", description: "Updated Chat Description" }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.updateChatGroup(req, res, next);
//             const updatedChat = res.json.mock.calls[0][0];
//             expect(res.status).toHaveBeenCalledWith(200);
//             expect(updatedChat.updatedChatGroup).toHaveProperty("name", "Updated Chat Name");
//             expect(updatedChat.updatedChatGroup).toHaveProperty("description", "Updated Chat Description");
//         });

//         it("should return 400 for missing chat ID when updating chat", async () => {
//             const res = mockRes();
//             const req: any = { params: { }, body: { name: "Updated Chat Name" }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.updateChatGroup(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID is required' });
//         });

//         it("should return 404 for non-existent chat when updating chat", async () => {
//             const res = mockRes();
//             const req: any = { params: { chatId: "nonexistent-chat-id" }, body: { name: "Updated Chat Name" }, user: { id: "123" } };
//             const next = jest.fn();
//             await chatService.updateChatGroup(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(404);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat group not found' });
//         });
//     });

//     describe("get unseen messages count", () => {

//         it("should retrieve unseen messages count successfully", async () => {
//             const chat = await chatService.CreateChatFun(true, ["123", "456"]) as any;
//             const res = mockRes();
//             const req: any = { params: { chatId: chat.id }, user: { id: "456" } };
//             const next = jest.fn();
//             await chatService.getUnseenMessagesCount(req, res, next);
//             const countObj = res.json.mock.calls[0][0];
//             expect(res.status).toHaveBeenCalledWith(200);
//             expect(countObj).toHaveProperty("unseenMessagesCount", 0);
//         });

//         it("should return 400 for missing chat ID when retrieving unseen messages count", async () => {
//             const res = mockRes();
//             const req: any = { params: { }, user: { id: "456" } };
//             const next = jest.fn();
//             await chatService.getUnseenMessagesCount(req, res, next);
//             expect(res.status).toHaveBeenCalledWith(400);
//             expect(res.json).toHaveBeenCalledWith({ error: 'Chat ID is required' });
//         });

//     });

});
