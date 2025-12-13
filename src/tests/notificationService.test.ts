jest.mock("@/app", () => ({
  socketService: {
    checkSocketStatus: jest.fn(),
    sendNotificationToUser: jest.fn(),
    sendUnseenNotificationsCount: jest.fn(),
  },
}));

jest.mock("@/application/services/FCMService", () => ({
  sendPushNotification: jest.fn(),
}));

jest.mock("@/background/jobs/notificationsJob", () => ({
  enqueueNewNotificationJob: jest.fn(),
}));

jest.mock("@/config/redis", () => ({
  redisClient: {
    lPush: jest.fn(),
  },
}));

jest.mock("@/application/services/ServerSideEvents", () => ({
  sendSSEMessage: jest.fn(),
}));

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import {
  sendOverSocket,
  sendOverFCM,
  addNotification,
} from "@/application/services/notification";
import { NotificationTitle } from "@prisma/client";
import { socketService } from "@/app";
import { sendPushNotification } from "@/application/services/FCMService";
import { enqueueNewNotificationJob } from "@/background/jobs/notificationsJob";
import { redisClient } from "@/config/redis";

describe("Notification Service Functions", () => {
  let testUserId: string;
  let actorUserId: string;
  let testTweetId: string;

  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running notification service tests with real database");

    const testUser = await prisma.user.upsert({
      where: { username: `notif_service_test_user_${Date.now()}` },
      update: {},
      create: {
        username: `notif_service_test_user_${Date.now()}`,
        email: `notif_service_test_${Date.now()}@example.com`,
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1990-01-01"),
        name: "Notification Service Test User",
        bio: "Testing notification service",
        verified: false,
        protectedAccount: false,
      },
    });
    testUserId = testUser.id;

    const actor = await prisma.user.upsert({
      where: { username: `notif_service_actor_${Date.now()}` },
      update: {},
      create: {
        username: `notif_service_actor_${Date.now()}`,
        email: `notif_service_actor_${Date.now()}@example.com`,
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1992-05-15"),
        name: "Notification Service Actor",
        bio: "Actor for notifications",
        verified: false,
        protectedAccount: false,
      },
    });
    actorUserId = actor.id;

    const tweet = await prisma.tweet.create({
      data: {
        content: "Test tweet for notifications",
        userId: testUserId,
        tweetType: "TWEET",
      },
    });
    testTweetId = tweet.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [testUserId] } },
    });

    await prisma.fcmToken.deleteMany({
      where: { userId: { in: [testUserId, actorUserId] } },
    });

    await prisma.tweet.deleteMany({
      where: { id: { in: [testTweetId] } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, actorUserId] } },
    });

    await prisma.$disconnect();
  });

  describe("sendOverSocket", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should send notification over socket when user is active", () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(true);

      const mockNotification = {
        id: "notif-1",
        title: NotificationTitle.LIKE,
        body: "User liked your post",
      };

      sendOverSocket(testUserId, mockNotification);

      expect(socketService.checkSocketStatus).toHaveBeenCalledWith(testUserId);
      expect(socketService.sendNotificationToUser).toHaveBeenCalledWith(
        testUserId,
        mockNotification
      );
    });

    it("should not send notification over socket when user is inactive", () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const mockNotification = {
        id: "notif-1",
        title: NotificationTitle.LIKE,
        body: "User liked your post",
      };

      sendOverSocket(testUserId, mockNotification);

      expect(socketService.checkSocketStatus).toHaveBeenCalledWith(testUserId);
      expect(socketService.sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("should handle different notification types", () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(true);

      const notificationTypes = [
        NotificationTitle.LIKE,
        NotificationTitle.RETWEET,
        NotificationTitle.MENTION,
        NotificationTitle.REPLY,
      ];

      notificationTypes.forEach((type) => {
        jest.clearAllMocks();
        (socketService.checkSocketStatus as jest.Mock).mockReturnValue(true);

        const mockNotification = {
          id: `notif-${type}`,
          title: type,
          body: `Test ${type} notification`,
        };

        sendOverSocket(testUserId, mockNotification);

        expect(socketService.sendNotificationToUser).toHaveBeenCalledWith(
          testUserId,
          mockNotification
        );
      });
    });

    it("should handle null or undefined notification gracefully", () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(true);

      sendOverSocket(testUserId, null);

      expect(socketService.checkSocketStatus).toHaveBeenCalledWith(testUserId);
      expect(socketService.sendNotificationToUser).toHaveBeenCalledWith(
        testUserId,
        null
      );
    });
  });

  describe("sendOverFCM", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should send FCM notification when user has FCM tokens", async () => {
      await prisma.fcmToken.create({
        data: {
          userId: testUserId,
          token: "valid-fcm-token-1",
          osType: "WEB",
        },
      });

      (sendPushNotification as jest.Mock).mockResolvedValue([]);

      await sendOverFCM(
        testUserId,
        NotificationTitle.LIKE,
        "User liked your post",
        {}
      );

      expect(sendPushNotification).toHaveBeenCalledWith(
        ["valid-fcm-token-1"],
        {
          title: NotificationTitle.LIKE,
          body: "User liked your post",
        },
        {}
      );

      await prisma.fcmToken.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should not send FCM notification when user has no FCM tokens", async () => {
      (sendPushNotification as jest.Mock).mockResolvedValue([]);

      await sendOverFCM(
        testUserId,
        NotificationTitle.LIKE,
        "User liked your post",
        {}
      );

      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("should delete invalid FCM tokens returned by sendPushNotification", async () => {
      const token1 = await prisma.fcmToken.create({
        data: {
          userId: testUserId,
          token: "valid-fcm-token-1",
          osType: "WEB",
        },
      });

      const token2 = await prisma.fcmToken.create({
        data: {
          userId: testUserId,
          token: "invalid-fcm-token-2",
          osType: "WEB",
        },
      });

      (sendPushNotification as jest.Mock).mockResolvedValue([
        "invalid-fcm-token-2",
      ]);

      await sendOverFCM(
        testUserId,
        NotificationTitle.LIKE,
        "User liked your post",
        {}
      );

      const remainingTokens = await prisma.fcmToken.findMany({
        where: { userId: testUserId },
      });

      expect(remainingTokens.length).toBe(1);
      expect(remainingTokens[0].token).toBe("valid-fcm-token-1");

      await prisma.fcmToken.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should handle multiple FCM tokens correctly", async () => {
      await prisma.fcmToken.createMany({
        data: [
          { userId: testUserId, token: "token-1", osType: "WEB" },
          { userId: testUserId, token: "token-2", osType: "WEB" },
          { userId: testUserId, token: "token-3", osType: "WEB" },
        ],
      });

      (sendPushNotification as jest.Mock).mockResolvedValue([]);

      await sendOverFCM(
        testUserId,
        NotificationTitle.RETWEET,
        "User reposted your post",
        {}
      );

      expect(sendPushNotification).toHaveBeenCalledWith(
        ["token-1", "token-2", "token-3"],
        {
          title: NotificationTitle.RETWEET,
          body: "User reposted your post",
        },
        {}
      );

      await prisma.fcmToken.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should pass dataPayload correctly to sendPushNotification", async () => {
      await prisma.fcmToken.create({
        data: {
          userId: testUserId,
          token: "test-token",
          osType: "WEB",
        },
      });

      (sendPushNotification as jest.Mock).mockResolvedValue([]);

      const customPayload = { customKey: "customValue", notifId: "123" };

      await sendOverFCM(
        testUserId,
        NotificationTitle.LIKE,
        "Test",
        customPayload
      );

      expect(sendPushNotification).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        customPayload
      );

      await prisma.fcmToken.deleteMany({
        where: { userId: testUserId },
      });
    });
  });

  describe("addNotification - System Notifications", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create PASSWORD_CHANGED system notification", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.PASSWORD_CHANGED,
        body: "Your password has been changed",
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUserId,
          title: NotificationTitle.PASSWORD_CHANGED,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.body).toBe("Your password has been changed successfully.");
      expect(notification?.isRead).toBe(false);

      // Verify user unseen count was incremented
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(user?.unseenNotificationCount).toBeGreaterThan(0);

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should create LOGIN system notification", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.LOGIN,
        body: "There was a login to your account",
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUserId,
          title: NotificationTitle.LOGIN,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.body).toContain("There was a login to your account");
      expect(notification?.isRead).toBe(false);

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should send system notification over socket when user is active", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(true);

      const notificationData = {
        title: NotificationTitle.PASSWORD_CHANGED,
        body: "Password changed",
      };

      await addNotification(testUserId, notificationData);

      expect(socketService.sendNotificationToUser).toHaveBeenCalled();

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should send system notification over FCM", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      await prisma.fcmToken.create({
        data: {
          userId: testUserId,
          token: "test-fcm-token",
          osType: "WEB",
        },
      });

      (sendPushNotification as jest.Mock).mockResolvedValue([]);

      const notificationData = {
        title: NotificationTitle.PASSWORD_CHANGED,
        body: "Password changed",
      };

      await addNotification(testUserId, notificationData);

      expect(sendPushNotification).toHaveBeenCalled();

      // Clean up
      await prisma.fcmToken.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });
  });

  describe("addNotification - Tweet Relevant Notifications", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should queue LIKE notification in Redis", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);
      (redisClient.lPush as jest.Mock).mockResolvedValue(1);
      (enqueueNewNotificationJob as jest.Mock).mockResolvedValue(undefined);

      const notificationData = {
        title: NotificationTitle.LIKE,
        body: "User liked your post",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      expect(redisClient.lPush).toHaveBeenCalled();
      expect(enqueueNewNotificationJob).toHaveBeenCalled();

      // Clean up
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should queue RETWEET notification in Redis", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);
      (redisClient.lPush as jest.Mock).mockResolvedValue(1);
      (enqueueNewNotificationJob as jest.Mock).mockResolvedValue(undefined);

      const notificationData = {
        title: NotificationTitle.RETWEET,
        body: "User reposted your post",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      expect(redisClient.lPush).toHaveBeenCalled();
      expect(enqueueNewNotificationJob).toHaveBeenCalled();

      // Clean up
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should create other tweet notifications directly to database", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.MENTION,
        body: "User mentioned you",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUserId,
          title: NotificationTitle.MENTION,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.tweetId).toBe(testTweetId);
      expect(notification?.actorId).toBe(actorUserId);

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });
  });

  describe("addNotification - Unseen Count Updates", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should increment unseenNotificationCount", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const initialUser = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      const initialCount = initialUser?.unseenNotificationCount || 0;

      const notificationData = {
        title: NotificationTitle.PASSWORD_CHANGED,
        body: "Password changed",
      };

      await addNotification(testUserId, notificationData);

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect((updatedUser?.unseenNotificationCount || 0) > initialCount).toBe(
        true
      );

      // Verify socket notification was sent
      expect(socketService.sendUnseenNotificationsCount).toHaveBeenCalledWith(
        testUserId,
        expect.any(Number)
      );

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should send updated count over socket", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.PASSWORD_CHANGED,
        body: "Password changed",
      };

      await addNotification(testUserId, notificationData);

      expect(socketService.sendUnseenNotificationsCount).toHaveBeenCalledWith(
        testUserId,
        expect.any(Number)
      );

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });
  });

  describe("addNotification - Edge Cases", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should handle notification with all optional fields", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.MENTION,
        body: "Complete notification",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId, title: NotificationTitle.MENTION },
      });

      expect(notification).toBeDefined();
      expect(notification?.tweetId).toBe(testTweetId);
      expect(notification?.actorId).toBe(actorUserId);

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should handle notification with special characters in body", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.MENTION,
        body: "User @john mentioned you in a tweet 🎉 #awesome",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId, title: NotificationTitle.MENTION },
      });

      expect(notification?.body).toContain("🎉");
      expect(notification?.body).toContain("@john");
      expect(notification?.body).toContain("#awesome");

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should handle LOGIN notification with user information", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.LOGIN,
        body: "Login notification",
      };

      await addNotification(testUserId, notificationData);

      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId, title: NotificationTitle.LOGIN },
      });

      expect(notification?.body).toContain("login");
      expect(notification?.body).toContain("@");

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });

    it("should not queue unsupported notification types", async () => {
      (socketService.checkSocketStatus as jest.Mock).mockReturnValue(false);

      const notificationData = {
        title: NotificationTitle.QUOTE,
        body: "User quoted your post",
        tweetId: testTweetId,
        actorId: actorUserId,
      };

      await addNotification(testUserId, notificationData);

      // QUOTE is not in tweetRelevantTitles, so it should be created directly
      const notification = await prisma.notification.findFirst({
        where: { userId: testUserId, title: NotificationTitle.QUOTE },
      });

      expect(notification).toBeDefined();

      // Clean up
      await prisma.notification.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.update({
        where: { id: testUserId },
        data: { unseenNotificationCount: 0 },
      });
    });
  });
});
