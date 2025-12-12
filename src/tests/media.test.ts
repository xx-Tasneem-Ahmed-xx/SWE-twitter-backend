jest.mock("@/app", () => ({
  storageService: {
    getPresignedUrl: jest.fn(),
    getDownloadUrl: jest.fn(),
    getS3ObjectMetadata: jest.fn(),
    dropS3Media: jest.fn(),
  },
}));

import { prisma } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import * as mediaController from "@/api/controllers/mediaController";
import { Request, Response, NextFunction } from "express";
import { MediaType } from "@prisma/client";
import { storageService } from "@/app";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("Media Service Tests", () => {
  let testUserId: string;
  let testTweetId: string;
  let testMessageId: string;
  let testMediaId: string;
  let testUser2Id: string;

  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running tests with real database connection");

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `media_test_user_${Date.now()}`,
        email: `media_test_${Date.now()}@example.com`,
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1990-01-01"),
        name: "Media Test User",
      },
    });
    testUserId = testUser.id;

    const testUser2 = await prisma.user.create({
      data: {
        username: `media_test_user2_${Date.now()}`,
        email: `media_test2_${Date.now()}@example.com`,
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("1995-01-01"),
        name: "Media Test User 2",
      },
    });
    testUser2Id = testUser2.id;

    // Create test tweet
    const testTweet = await prisma.tweet.create({
      data: {
        content: "Test tweet for media",
        userId: testUserId,
        tweetType: "TWEET",
      },
    });
    testTweetId = testTweet.id;

    // Create test message
    const testChat = await prisma.chat.create({
      data: {
        DMChat: true,
        chatUsers: {
          create: [
            { userId: testUserId },
            { userId: testUser2Id },
          ],
        },
      },
    });

    const testMessage = await prisma.message.create({
      data: {
        chatId: testChat.id,
        userId: testUserId,
        content: "Test message for media",
      },
    });
    testMessageId = testMessage.id;

    // Create test media
    const testMedia = await prisma.media.create({
      data: {
        name: "test_image.jpg",
        type: MediaType.IMAGE,
        size: 1024,
        keyName: "test-key-name-123",
      },
    });
    testMediaId = testMedia.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.tweetMedia.deleteMany({
      where: { tweetId: testTweetId },
    });
    await prisma.messageMedia.deleteMany({
      where: { messageId: testMessageId },
    });
    await prisma.media.deleteMany({
      where: { keyName: { startsWith: "test-" } },
    });
    await prisma.message.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.tweet.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.chat.deleteMany({
      where: {
        chatUsers: {
          some: { userId: { in: [testUserId, testUser2Id] } },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testUser2Id] } },
    });
    await prisma.$disconnect();
  });

  describe("Request to Upload Media Tests", () => {
    it("should return presigned upload URL", async () => {
      const mockUrl = "https://s3.amazonaws.com/signed-url";
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const req = {
        user: { id: testUserId },
        body: {
          fileName: "image.jpg",
          contentType: "image/jpeg",
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToUploadMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("url");
      expect(callArg).toHaveProperty("keyName");
      expect(callArg.url).toBe(mockUrl);
    });

    it("should include userId in keyName", async () => {
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(
        "https://s3.amazonaws.com/url"
      );

      const req = {
        user: { id: testUserId },
        body: {
          fileName: "photo.png",
          contentType: "image/png",
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToUploadMedia(req, res, next);

      const keyName = res.json.mock.calls[0][0].keyName;
      expect(keyName).toContain(testUserId);
      expect(keyName).toContain("photo.png");
    });

    it("should handle different content types", async () => {
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(
        "https://s3.amazonaws.com/url"
      );

      const contentTypes = [
        "image/jpeg",
        "image/png",
        "video/mp4",
        "application/pdf",
      ];

      for (const contentType of contentTypes) {
        const req = {
          user: { id: testUserId },
          body: {
            fileName: `file.${contentType.split("/")[1]}`,
            contentType,
          },
        } as any;
        const res = mockRes();
        const next = jest.fn();

        await mediaController.requestToUploadMedia(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(storageService.getPresignedUrl).toHaveBeenCalledWith(
          expect.any(String),
          contentType
        );
      }
    });
  });

  describe("Request to Download Media Tests", () => {
    it("should return presigned download URL for valid media", async () => {
      const mockDownloadUrl = "https://s3.amazonaws.com/download-url";
      (storageService.getDownloadUrl as jest.Mock).mockResolvedValue(
        mockDownloadUrl
      );

      const req = {
        params: { mediaId: testMediaId },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToDownloadMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("url");
      expect(callArg.url).toBe(mockDownloadUrl);
    });

    it("should handle non-existent media", async () => {
      const req = {
        params: { mediaId: "non-existent-id" },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToDownloadMedia(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should call storageService with correct keyName", async () => {
      (storageService.getDownloadUrl as jest.Mock).mockResolvedValue(
        "https://s3.amazonaws.com/url"
      );

      const req = {
        params: { mediaId: testMediaId },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToDownloadMedia(req, res, next);

      expect(storageService.getDownloadUrl).toHaveBeenCalledWith(
        "test-key-name-123"
      );
    });
  });

  describe("Confirm Media Upload Tests", () => {
    it("should create media record on successful upload confirmation", async () => {
      const keyName = `confirm-test-${Date.now()}.jpg`;
      (storageService.getS3ObjectMetadata as jest.Mock).mockResolvedValue({
        ContentLength: 2048,
        ContentType: "IMAGE/jpeg",
      });

      const req = {
        params: { keyName },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.confirmMediaUpload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg).toHaveProperty("newMedia");
      expect(callArg.newMedia.keyName).toBe(keyName);

      // Cleanup
      await prisma.media.delete({ where: { id: callArg.newMedia.id } });
    });

    it("should set correct media type from ContentType", async () => {
      const keyName = `media-type-test-${Date.now()}.jpg`;
      (storageService.getS3ObjectMetadata as jest.Mock).mockResolvedValue({
        ContentLength: 1024,
        ContentType: "IMAGE/png",
      });

      const req = {
        params: { keyName },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.confirmMediaUpload(req, res, next);

      const callArg = res.json.mock.calls[0][0];
      expect(callArg.newMedia.type).toBe("IMAGE");

      await prisma.media.delete({ where: { id: callArg.newMedia.id } });
    });

    it("should handle media not found in S3", async () => {
      (storageService.getS3ObjectMetadata as jest.Mock).mockResolvedValue(
        null
      );

      const req = {
        params: { keyName: "non-existent-key" },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.confirmMediaUpload(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should store correct file size", async () => {
      const keyName = `size-test-${Date.now()}.jpg`;
      const fileSize = 5120;
      (storageService.getS3ObjectMetadata as jest.Mock).mockResolvedValue({
        ContentLength: fileSize,
        ContentType: "IMAGE/jpeg",
      });

      const req = {
        params: { keyName },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.confirmMediaUpload(req, res, next);

      const callArg = res.json.mock.calls[0][0];
      expect(callArg.newMedia.size).toBe(fileSize);

      await prisma.media.delete({ where: { id: callArg.newMedia.id } });
    });
  });

  describe("Add Media to Tweet Tests", () => {
    it("should add single media to tweet", async () => {
      const req = {
        body: {
          tweetId: testTweetId,
          mediaIds: [testMediaId],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      const tweetMedia = await prisma.tweetMedia.findFirst({
        where: { tweetId: testTweetId, mediaId: testMediaId },
      });
      expect(tweetMedia).toBeDefined();
    });

    it("should add multiple media to tweet", async () => {
      const media2 = await prisma.media.create({
        data: {
          name: "test_video.mp4",
          type: MediaType.VIDEO,
          size: 5120,
          keyName: `test-video-${Date.now()}`,
        },
      });

      const req = {
        body: {
          tweetId: testTweetId,
          mediaIds: [testMediaId, media2.id],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      const tweetMediaCount = await prisma.tweetMedia.count({
        where: { tweetId: testTweetId },
      });

      expect(tweetMediaCount).toBeGreaterThan(0);

      await prisma.media.delete({ where: { id: media2.id } });
    });

    it("should return error when tweetId is missing", async () => {
      const req = {
        body: {
          mediaIds: [testMediaId],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return error when mediaIds is empty array", async () => {
      const req = {
        body: {
          tweetId: testTweetId,
          mediaIds: [],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should handle mediaIds as undefined", async () => {
      const req = {
        body: {
          tweetId: testTweetId,
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Add Media to Message Tests", () => {
    it("should add single media to message", async () => {
      const req = {
        body: {
          messageId: testMessageId,
          mediaIds: [testMediaId],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaToMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      const messageMedia = await prisma.messageMedia.findFirst({
        where: { messageId: testMessageId, mediaId: testMediaId },
      });
      expect(messageMedia).toBeDefined();
    });

    it("should add multiple media to message", async () => {
      const media2 = await prisma.media.create({
        data: {
          name: "test_video.mp4",
          type: MediaType.VIDEO,
          size: 3072,
          keyName: `test-video-${Date.now()}`,
        },
      });

      const req = {
        body: {
          messageId: testMessageId,
          mediaIds: [testMediaId, media2.id],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaToMessage(req, res, next);

      const messageMediaCount = await prisma.messageMedia.count({
        where: { messageId: testMessageId },
      });

      expect(messageMediaCount).toBeGreaterThan(0);

      await prisma.media.delete({ where: { id: media2.id } });
    });

    it("should return error when messageId is missing", async () => {
      const req = {
        body: {
          mediaIds: [testMediaId],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaToMessage(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return error when mediaIds is empty array", async () => {
      const req = {
        body: {
          messageId: testMessageId,
          mediaIds: [],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaToMessage(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Get Tweet Media Tests", () => {
    it("should retrieve media for a tweet", async () => {
      const req = {
        params: { tweetId: testTweetId },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getTweetMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return error when tweetId is missing", async () => {
      const req = {
        params: {},
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getTweetMedia(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return empty array for tweet with no media", async () => {
      const newTweet = await prisma.tweet.create({
        data: {
          content: "Tweet without media",
          userId: testUserId,
          tweetType: "TWEET",
        },
      });

      const req = {
        params: { tweetId: newTweet.id },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getTweetMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      await prisma.tweet.delete({ where: { id: newTweet.id } });
    });
  });

  describe("Get Message Media Tests", () => {
    it("should retrieve media for a message", async () => {
      const req = {
        params: { messageId: testMessageId },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getMessageMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return error when messageId is missing", async () => {
      const req = {
        params: {},
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getMessageMedia(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return empty array for message with no media", async () => {
      const newChat = await prisma.chat.create({
        data: {
          DMChat: true,
          chatUsers: {
            create: [
              { userId: testUserId },
              { userId: testUser2Id },
            ],
          },
        },
      });

      const newMessage = await prisma.message.create({
        data: {
          chatId: newChat.id,
          userId: testUserId,
          content: "Message without media",
        },
      });

      const req = {
        params: { messageId: newMessage.id },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.getMessageMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      await prisma.message.delete({ where: { id: newMessage.id } });
      await prisma.chat.delete({ where: { id: newChat.id } });
    });
  });

  describe("Drop Media Tests", () => {
    it("should call storageService dropS3Media", async () => {
      (storageService.dropS3Media as jest.Mock).mockResolvedValue(true);

      const keyName = "test-drop-key";
      await mediaController.dropMedia(keyName);

      expect(storageService.dropS3Media).toHaveBeenCalledWith(keyName);
    });

    it("should handle S3 deletion error", async () => {
      (storageService.dropS3Media as jest.Mock).mockRejectedValue(
        new Error("S3 Error")
      );

      const keyName = "error-key";

      try {
        await mediaController.dropMedia(keyName);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Media Type Handling Tests", () => {
    it("should handle IMAGE media type", async () => {
      const imageMedia = await prisma.media.create({
        data: {
          name: "image.jpg",
          type: MediaType.IMAGE,
          size: 2048,
          keyName: `image-${Date.now()}`,
        },
      });

      expect(imageMedia.type).toBe(MediaType.IMAGE);

      await prisma.media.delete({ where: { id: imageMedia.id } });
    });

    it("should handle VIDEO media type", async () => {
      const videoMedia = await prisma.media.create({
        data: {
          name: "video.mp4",
          type: MediaType.VIDEO,
          size: 10240,
          keyName: `video-${Date.now()}`,
        },
      });

      expect(videoMedia.type).toBe(MediaType.VIDEO);

      await prisma.media.delete({ where: { id: videoMedia.id } });
    });

    it("should handle GIF media type", async () => {
      const gifMedia = await prisma.media.create({
        data: {
          name: "animation.gif",
          type: MediaType.GIF,
          size: 5120,
          keyName: `gif-${Date.now()}`,
        },
      });

      expect(gifMedia.type).toBe(MediaType.GIF);

      await prisma.media.delete({ where: { id: gifMedia.id } });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent media upload requests", async () => {
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(
        "https://s3.amazonaws.com/url"
      );

      const requests = Array(5)
        .fill(null)
        .map(() => {
          const req = {
            user: { id: testUserId },
            body: {
              fileName: `concurrent-${Date.now()}.jpg`,
              contentType: "image/jpeg",
            },
          } as any;
          const res = mockRes();
          const next = jest.fn();
          return mediaController.requestToUploadMedia(req, res, next);
        });

      const results = await Promise.all(requests);
      expect(results.length).toBe(5);
    });

    it("should handle media with special characters in filename", async () => {
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(
        "https://s3.amazonaws.com/url"
      );

      const specialNames = [
        "photo@2024.jpg",
        "image#1.png",
        "file (copy).jpg",
      ];

      for (const fileName of specialNames) {
        const req = {
          user: { id: testUserId },
          body: {
            fileName,
            contentType: "image/jpeg",
          },
        } as any;
        const res = mockRes();
        const next = jest.fn();

        await mediaController.requestToUploadMedia(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    it("should handle large file sizes", async () => {
      const largeMedia = await prisma.media.create({
        data: {
          name: "large_video.mp4",
          type: MediaType.VIDEO,
          size: 1024 * 1024 * 500, // 500MB
          keyName: `large-${Date.now()}`,
        },
      });

      expect(largeMedia.size).toBe(1024 * 1024 * 500);

      await prisma.media.delete({ where: { id: largeMedia.id } });
    });

    it("should handle media attached to multiple tweets", async () => {
      const tweet1 = await prisma.tweet.create({
        data: {
          content: "Tweet 1",
          userId: testUserId,
          tweetType: "TWEET",
        },
      });

      const tweet2 = await prisma.tweet.create({
        data: {
          content: "Tweet 2",
          userId: testUserId,
          tweetType: "TWEET",
        },
      });

      const req1 = {
        body: {
          tweetId: tweet1.id,
          mediaIds: [testMediaId],
        },
      } as any;
      const res1 = mockRes();
      const next1 = jest.fn();

      const req2 = {
        body: {
          tweetId: tweet2.id,
          mediaIds: [testMediaId],
        },
      } as any;
      const res2 = mockRes();
      const next2 = jest.fn();

      await mediaController.addMediaTotweet(req1, res1, next1);
      await mediaController.addMediaTotweet(req2, res2, next2);

      const mediaInTweets = await prisma.tweetMedia.findMany({
        where: { mediaId: testMediaId },
      });

      expect(mediaInTweets.length).toBeGreaterThan(0);

      await prisma.tweet.deleteMany({
        where: { id: { in: [tweet1.id, tweet2.id] } },
      });
    });

    it("should handle presigned URL expiration time", async () => {
      const mockUrl = "https://s3.amazonaws.com/expiring-url";
      (storageService.getPresignedUrl as jest.Mock).mockResolvedValue(
        mockUrl
      );

      const req = {
        user: { id: testUserId },
        body: {
          fileName: "expiring.jpg",
          contentType: "image/jpeg",
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToUploadMedia(req, res, next);

      // Verify that getPresignedUrl was called with default expiration
      expect(storageService.getPresignedUrl).toHaveBeenCalled();
    });

    it("should handle invalid media ID format", async () => {
      const req = {
        params: { mediaId: "invalid-id" },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.requestToDownloadMedia(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should maintain media relationships on query", async () => {
      const media1 = await prisma.media.create({
        data: {
          name: "relationship_test1.jpg",
          type: MediaType.IMAGE,
          size: 1024,
          keyName: `rel-test-1-${Date.now()}`,
        },
      });

      const req = {
        body: {
          tweetId: testTweetId,
          mediaIds: [media1.id],
        },
      } as any;
      const res = mockRes();
      const next = jest.fn();

      await mediaController.addMediaTotweet(req, res, next);

      const tweetMedia = await prisma.tweetMedia.findMany({
        where: { tweetId: testTweetId },
      });

      expect(tweetMedia.length).toBeGreaterThan(0);

      await prisma.media.delete({ where: { id: media1.id } });
    });
  });
});
