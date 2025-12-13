jest.mock("@/app", () => ({
  socketService: {
    sendMessageToChat: jest.fn(),
    checkSocketStatus: jest.fn().mockReturnValue(false),
    sendNotificationToUser: jest.fn(),
    sendUnseenNotificationsCount: jest.fn(),
  },
}));

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import * as notificationController from "@/api/controllers/notificationController";
import { Request, Response, NextFunction } from "express";
import { NotificationTitle } from "@prisma/client";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("Notification Service Tests", () => {
  let testUser1Id: string;
  let testUser2Id: string;
  let notificationId: string;

  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running tests with real database connection");

    // Create test users
    const user1 = await prisma.user.upsert({
      where: { username: "notification_test_user1" },
      update: {},
      create: {
        username: "notification_test_user1",
        email: "notif_test1@example.com",
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1990-01-01"),
        name: "Notification Test User 1",
        bio: "Test user for notifications",
        verified: false,
        protectedAccount: false,
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.upsert({
      where: { username: "notification_test_user2" },
      update: {},
      create: {
        username: "notification_test_user2",
        email: "notif_test2@example.com",
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1992-05-15"),
        name: "Notification Test User 2",
        bio: "Another test user",
        verified: false,
        protectedAccount: false,
      },
    });
    testUser2Id = user2.id;

    // Create a test notification (without tweetId to avoid foreign key constraint)
    const notification = await prisma.notification.create({
      data: {
        userId: testUser1Id,
        title: NotificationTitle.LIKE,
        body: "User liked your post",
        isRead: false,
        actorId: testUser2Id,
      },
    });
    notificationId = notification.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [testUser1Id, testUser2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser1Id, testUser2Id] } },
    });
    await prisma.$disconnect();
  });

  describe("Get Notifications List Tests", () => {
    it("should retrieve all notifications for a user", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("notifications");
      expect(Array.isArray(callArg.notifications)).toBe(true);
    });

    it("should mark notifications as read when fetching list", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      const user = await prisma.user.findUnique({
        where: { id: testUser1Id },
      });
      expect(user?.unseenNotificationCount).toBe(0);
    });

    it("should include actor information in notifications", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      if (callArg.notifications.length > 0) {
        expect(callArg.notifications[0]).toHaveProperty("actor");
      }
    });

    it("should return empty array when user has no notifications", async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `test_no_notif_${Date.now()}`,
          email: `no_notif_${Date.now()}@example.com`,
          password: "pass123",
          saltPassword: "salt",
          dateOfBirth: new Date("1995-01-01"),
          name: "User with No Notifications",
        },
      });

      const req = { user: { id: newUser.id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.notifications).toEqual([]);

      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it("should return error for non-existent user", async () => {
      const req = { user: { id: "non-existent-user-id" } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Get Mention Notifications Tests", () => {
    beforeEach(async () => {
      // Create a mention notification (without tweetId to avoid foreign key constraint)
      await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.MENTION,
          body: "User mentioned you",
          isRead: false,
          actorId: testUser2Id,
        },
      });
    });

    it("should retrieve only mention notifications", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getMentionNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("mentionNotifications");
      expect(Array.isArray(callArg.mentionNotifications)).toBe(true);

      // Verify all are mention notifications
      callArg.mentionNotifications.forEach((notif: any) => {
        expect(notif.title).toBe(NotificationTitle.MENTION);
      });
    });

    it("should return empty array when no mention notifications exist", async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `test_no_mentions_${Date.now()}`,
          email: `no_mentions_${Date.now()}@example.com`,
          password: "pass123",
          saltPassword: "salt",
          dateOfBirth: new Date("1995-01-01"),
          name: "User with No Mentions",
        },
      });

      const req = { user: { id: newUser.id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getMentionNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.mentionNotifications).toEqual([]);

      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it("should include actor information in mention notifications", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getMentionNotifications(req, res, next);

      const callArg = res.json.mock.calls[0][0];
      if (callArg.mentionNotifications.length > 0) {
        expect(callArg.mentionNotifications[0]).toHaveProperty("actor");
      }
    });
  });

  describe("Get Unseen Notifications Count Tests", () => {
    it("should return unseen notifications count", async () => {
      // Create an unseen notification
      await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.LIKE,
          body: "User liked your post",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotificationsCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("unseenCount");
      expect(typeof callArg.unseenCount).toBe("number");
    });

    it("should return 0 when all notifications are read", async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `test_all_read_${Date.now()}`,
          email: `all_read_${Date.now()}@example.com`,
          password: "pass123",
          saltPassword: "salt",
          dateOfBirth: new Date("1995-01-01"),
          name: "User All Read",
          unseenNotificationCount: 0,
        },
      });

      const req = { user: { id: newUser.id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotificationsCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.unseenCount).toBe(0);

      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it("should return error for non-existent user", async () => {
      const req = { user: { id: "non-existent-id" } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotificationsCount(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Get Unseen Notifications Tests", () => {
    beforeEach(async () => {
      // Ensure user has unseen notifications
      await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.RETWEET,
          body: "User reposted your post",
          isRead: false,
          actorId: testUser2Id,
        },
      });
    });

    it("should retrieve only unseen notifications", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("unseenNotifications");
      expect(Array.isArray(callArg.unseenNotifications)).toBe(true);
    });

    it("should mark unseen notifications as read", async () => {
      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotifications(req, res, next);

      const user = await prisma.user.findUnique({
        where: { id: testUser1Id },
      });
      expect(user?.unseenNotificationCount).toBe(0);
    });

    it("should return error when user ID is missing", async () => {
      const req = { user: {} } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotifications(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return empty array when no unseen notifications", async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `test_no_unseen_${Date.now()}`,
          email: `no_unseen_${Date.now()}@example.com`,
          password: "pass123",
          saltPassword: "salt",
          dateOfBirth: new Date("1995-01-01"),
          name: "User No Unseen",
          unseenNotificationCount: 0,
        },
      });

      const req = { user: { id: newUser.id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getUnseenNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.unseenNotifications).toEqual([]);

      await prisma.user.delete({ where: { id: newUser.id } });
    });
  });

  describe("Mark Notifications as Read Tests", () => {
    beforeEach(async () => {
      // Create multiple unseen notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUser1Id,
            title: NotificationTitle.LIKE,
            body: "User 1 liked your post",
            isRead: false,
            actorId: testUser2Id,
          },
          {
            userId: testUser1Id,
            title: NotificationTitle.RETWEET,
            body: "User 2 reposted your post",
            isRead: false,
            actorId: testUser2Id,
          },
        ],
      });

      // Update user unseen count
      await prisma.user.update({
        where: { id: testUser1Id },
        data: { unseenNotificationCount: 2 },
      });
    });

    it("should mark all unseen notifications as read", async () => {
      await notificationController.markNotificationsAsRead(testUser1Id);

      const unreadNotifications = await prisma.notification.findMany({
        where: { userId: testUser1Id, isRead: false },
      });

      expect(unreadNotifications.length).toBe(0);
    });

    it("should reset unseenNotificationCount to 0", async () => {
      await notificationController.markNotificationsAsRead(testUser1Id);

      const user = await prisma.user.findUnique({
        where: { id: testUser1Id },
      });

      expect(user?.unseenNotificationCount).toBe(0);
    });

    it("should handle user with no unseen notifications", async () => {
      const newUser = await prisma.user.create({
        data: {
          username: `test_mark_read_${Date.now()}`,
          email: `mark_read_${Date.now()}@example.com`,
          password: "pass123",
          saltPassword: "salt",
          dateOfBirth: new Date("1995-01-01"),
          name: "User Mark Read",
          unseenNotificationCount: 0,
        },
      });

      const result = await notificationController.markNotificationsAsRead(
        newUser.id
      );

      expect(result).not.toBeInstanceOf(Error);

      await prisma.user.delete({ where: { id: newUser.id } });
    });
  });

  describe("Notification Types Tests", () => {
    it("should handle LIKE notifications", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.LIKE,
          body: "liked your post",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.title).toBe(NotificationTitle.LIKE);
      expect(notification).toHaveProperty("actorId");

      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it("should handle MENTION notifications", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.MENTION,
          body: "mentioned you",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.title).toBe(NotificationTitle.MENTION);

      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it("should handle RETWEET notifications", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.RETWEET,
          body: "reposted your post",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.title).toBe(NotificationTitle.RETWEET);

      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it("should handle REPLY notifications", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.REPLY,
          body: "replied to your post",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.title).toBe(NotificationTitle.REPLY);

      await prisma.notification.delete({ where: { id: notification.id } });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent notification retrieval", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => {
          const req = { user: { id: testUser1Id } } as any;
          const res = mockRes();
          const next = jest.fn();
          return notificationController.getNotificationList(req, res, next);
        });

      const results = await Promise.all(requests);
      expect(results.length).toBe(5);
    });

    it("should handle notifications with special characters", async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.LIKE,
          body: "liked your post 🎉 @user #hashtag",
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.body).toContain("🎉");
      expect(notification.body).toContain("@user");
      expect(notification.body).toContain("#hashtag");

      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it("should handle notifications with long body text", async () => {
      const longBody = "x".repeat(280);
      const notification = await prisma.notification.create({
        data: {
          userId: testUser1Id,
          title: NotificationTitle.LIKE,
          body: longBody,
          isRead: false,
          actorId: testUser2Id,
        },
      });

      expect(notification.body.length).toBe(280);

      await prisma.notification.delete({ where: { id: notification.id } });
    });

    it("should handle multiple notifications from same actor", async () => {
      const notifications = await prisma.notification.createMany({
        data: [
          {
            userId: testUser1Id,
            title: NotificationTitle.LIKE,
            body: "liked your post",
            isRead: false,
            actorId: testUser2Id,
          },
          {
            userId: testUser1Id,
            title: NotificationTitle.RETWEET,
            body: "reposted your post",
            isRead: false,
            actorId: testUser2Id,
          },
          {
            userId: testUser1Id,
            title: NotificationTitle.MENTION,
            body: "mentioned you",
            isRead: false,
            actorId: testUser2Id,
          },
        ],
      });

      expect(notifications.count).toBe(3);

      await prisma.notification.deleteMany({
        where: { userId: testUser1Id, actorId: testUser2Id },
      });
    });

    it("should handle user with many notifications", async () => {
      // Create 50 notifications
      const notificationsData = Array(50)
        .fill(null)
        .map((_, i) => ({
          userId: testUser1Id,
          title: (
            Object.values(NotificationTitle) as string[]
          )[i % Object.keys(NotificationTitle).length] as NotificationTitle,
          body: `Notification ${i + 1}`,
          isRead: i % 2 === 0, // Half read, half unread
          actorId: testUser2Id,
        }));

      const result = await prisma.notification.createMany({
        data: notificationsData,
      });

      expect(result.count).toBe(50);

      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      await prisma.notification.deleteMany({
        where: { userId: testUser1Id, body: { startsWith: "Notification" } },
      });
    });

    it("should handle notification ordering by creation date", async () => {
      const notifications = await prisma.notification.createMany({
        data: [
          {
            userId: testUser1Id,
            title: NotificationTitle.LIKE,
            body: "First notification",
            isRead: false,
            actorId: testUser2Id,
          },
          {
            userId: testUser1Id,
            title: NotificationTitle.RETWEET,
            body: "Second notification",
            isRead: false,
            actorId: testUser2Id,
          },
        ],
      });

      const req = { user: { id: testUser1Id } } as any;
      const res = mockRes();
      const next = jest.fn();

      await notificationController.getNotificationList(req, res, next);

      const callArg = res.json.mock.calls[0][0];
      if (callArg.notifications.length >= 2) {
        expect(
          new Date(callArg.notifications[0].createdAt).getTime() >=
            new Date(callArg.notifications[1].createdAt).getTime()
        ).toBe(true);
      }

      await prisma.notification.deleteMany({
        where: { userId: testUser1Id, body: { contains: "notification" } },
      });
    });
  });
});