jest.mock("@/app", () => ({
  socketService: {
    // used by other tests too
    sendMessageToChat: jest.fn(),

    // used by notificationController
    checkSocketStatus: jest.fn().mockReturnValue(false),   // default: recipient offline
    sendNotificationToUser: jest.fn(),
  },
}));

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import * as notificationService from "../api/controllers/notificationController";
import { body, param } from "express-validator";
import { newMessageInput } from "@/application/dtos/chat/messages.dto";
import { log } from "node:console";
import { Request } from "express";
import { NotificationInputSchema } from "@/application/dtos/notification/notification.dto";
import { UUID } from "node:crypto";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}


describe("notification service", () => {
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

    });

    afterAll(async () => {
        await prisma.notification.deleteMany({
            where: { userId: "123" }
        });
        await prisma.user.deleteMany({
            where: { id: { in: ["123", "456", "789"] } },
        });
        await prisma.$disconnect();
    });


    beforeEach(async () => {
        
    });

    describe("get notifications list of a user", () => {
        it("should return notifications for a user", async () => {
            const req = {
                user: { id: "123" },
            } as Request;
            const res = mockRes();

            await notificationService.getNotificationList(req, res,()=>{});

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({"notifications": []});
        });

    //     it("should return 401 if user is unauthorized", async () => {
    //         const req = {
    //             user: { id: "nonexistent" },
    //         } as Request;
    //         const res = mockRes();
    //         await notificationService.getNotificationList(req, res);

    //         expect(res.status).toHaveBeenCalledWith(401);
    //         expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    //     });
    // });

    // describe("get unseen notifications count of a user", () => {
    //     it("should return unseen notifications count for a user", async () => {
    //         const req = {
    //             user: { id: "123" },
    //         } as Request;
    //         const res = mockRes();

    //         await notificationService.getUnseenNotificationsCount(req, res);

    //         expect(res.status).toHaveBeenCalledWith(200);
    //         expect(res.json).toHaveBeenCalledWith({  "unseenCount": 0 });
    //     });
    //     it("should return 401 if user is unauthorized", async () => {
    //         const req = {
    //             user: { id: "nonexistent" },
    //         } as Request;
    //         const res = mockRes();
    //         await notificationService.getUnseenNotificationsCount(req, res);

    //         expect(res.status).toHaveBeenCalledWith(401);
    //         expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    //     });
    });

    // describe("get unseen notifications of a user", () => {
    //     it("should return unseen notifications for a user", async () => {
    //         const req = {
    //             user: { id: "123" },
    //         } as Request;
    //         const res = mockRes();
    //         await notificationService.getUnseenNotifications(req, res);

    //         expect(res.status).toHaveBeenCalledWith(200);
    //         expect(res.json).toHaveBeenCalledWith({ "unseenNotifications": [] });
    //     });
    //     it("should return 401 if user is unauthorized", async () => {
    //         const req = {
    //             user: { id: "" },
    //         } as Request;
    //         const res = mockRes();
    //         await notificationService.getUnseenNotifications(req, res);

    //         expect(res.status).toHaveBeenCalledWith(401);
    //         expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    //     });
    // });
});