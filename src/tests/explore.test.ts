import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
import { ExploreService } from "@/application/services/explore";
import {
  encoderService,
  initEncoderService,
} from "@/application/services/encoder";
import z from "zod";
import { User } from "@prisma/client";
let connectToDatabase: any;
const exploreService = ExploreService.getInstance();
jest.mock("@/application/services/notification", () => ({
  addNotification: jest.fn().mockResolvedValue(undefined),
}));
beforeAll(async () => {
  await initRedis();
  await loadSecrets();
  await initEncoderService();
  connectToDatabase = (await import("@/database")).connectToDatabase;
});
let user: User, mutedUser: User, blockedUser: User;
const CAT1 = "550e8400-e29b-41d4-a716-446655440001";
const CAT2 = "550e8400-e29b-41d4-a716-446655440002";
const CAT3 = "550e8400-e29b-41d4-a716-446655440003";

describe("ExploreService", () => {
  beforeAll(async () => {
    await connectToDatabase();

    user = await prisma.user.upsert({
      where: { username: "test_user1" },
      update: {},
      create: {
        username: "test_user1",
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "test_user1@example.com",
        password: "password456",
        saltPassword: "salt456",
        name: "Test User one",
      },
    });

    mutedUser = await prisma.user.upsert({
      where: { username: "test_user2" },
      update: {},
      create: {
        username: "test_user2",
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "test_user2@example.com",
        password: "password456",
        saltPassword: "salt456",
        name: "Test User two",
      },
    });

    blockedUser = await prisma.user.upsert({
      where: { username: "test_user3" },
      update: {},
      create: {
        username: "test_user3",
        id: "550e8400-e29b-41d4-a716-446655440002",
        email: "test_user3@example.com",
        password: "password456",
        saltPassword: "salt456",
        name: "Test User three",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [user.id, mutedUser.id, blockedUser.id] } },
    });
    await prisma.category.deleteMany({
      where: { id: { in: [CAT1, CAT2, CAT3] } },
    });
    await prisma.tweet.deleteMany({
      where: { userId: { in: [user.id, mutedUser.id, blockedUser.id] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.category.upsert({
      where: { id: CAT1 },
      update: { name: "Sports" },
      create: { id: CAT1, name: "Sports" },
    });

    await prisma.category.upsert({
      where: { id: CAT2 },
      update: { name: "Music" },
      create: { id: CAT2, name: "Music" },
    });

    await prisma.category.upsert({
      where: { id: CAT3 },
      update: { name: "Tech" },
      create: { id: CAT3, name: "Tech" },
    });
  });

  describe("getCategories", () => {
    it("should return categories with default limit", async () => {
      const dto = { limit: 2 };
      const result = await exploreService.getCategories(dto);

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.cursor).toBeDefined();
    });

    it("should paginate with cursor", async () => {
      const firstPage = await exploreService.getCategories({ limit: 1 });
      const cursor = encoderService.decode<{
        id: string;
      }>(firstPage.cursor as string);

      const secondPage = await exploreService.getCategories({
        limit: 1,
        cursor: cursor ?? undefined,
      });

      expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    });

    it("should return empty array if no categories exist", async () => {
      await prisma.tweetCategory.deleteMany();
      await prisma.category.deleteMany();
      const result = await exploreService.getCategories({ limit: 2 });
      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });
  });

  describe("saveUserPreferredCategories", () => {
    it("should save one preferred category", async () => {
      const dto = { categoryIds: [CAT1] };
      const result = await exploreService.saveUserPreferredCategories(
        user.id,
        dto
      );

      expect(result.id).toBe(user.id);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferredCategories: true },
      });
      expect(updatedUser?.preferredCategories.map((c) => c.id)).toContain(CAT1);
    });

    it("should save multiple preferred categories", async () => {
      const dto = { categoryIds: [CAT1, CAT2] };
      await exploreService.saveUserPreferredCategories(user.id, dto);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferredCategories: true },
      });
      expect(updatedUser?.preferredCategories.length).toBe(2);
    });

    it("should throw ZodError if no categories provided", async () => {
      const dto = { categoryIds: [] };

      await expect(
        exploreService.saveUserPreferredCategories(user.id, dto)
      ).rejects.toThrow(z.ZodError);
    });

    it("should throw error if category does not exist", async () => {
      const dto = { categoryIds: ["nonexistent"] };
      await expect(
        exploreService.saveUserPreferredCategories(user.id, dto)
      ).rejects.toThrow();
    });

    it("should throw error if user does not exist", async () => {
      const dto = { categoryIds: [CAT1] };
      await expect(
        exploreService.saveUserPreferredCategories("fake-user", dto)
      ).rejects.toThrow();
    });
  });

  describe("getFeed", () => {
    it("should return tweets for the user", async () => {
      const tweet = await prisma.tweet.create({
        data: {
          id: "t1",
          content: "bla bla bla",
          userId: user.id,
          tweetType: "TWEET",
          score: 10,
          tweetCategories: { create: { categoryId: CAT1 } },
        },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(result.data.map((t) => t.id)).toContain(tweet.id);
    });

    it("should filter by category", async () => {
      await prisma.tweet.create({
        data: {
          id: "t2",
          content: "Sports tweet",
          userId: user.id,
          tweetType: "TWEET",
          score: 5,
          tweetCategories: { create: { categoryId: CAT1 } },
        },
      });
      await prisma.tweet.create({
        data: {
          id: "t3",
          content: "Music tweet",
          userId: user.id,
          tweetType: "TWEET",
          score: 5,
          tweetCategories: { create: { categoryId: CAT2 } },
        },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
        categoryId: CAT1,
      });
      for (const tweet of result.data) {
        const ids = tweet.tweetCategories.map((c: any) => c.categoryId);
        expect(ids).toContain(CAT1);
      }
    });

    it("should exclude tweets from blocked users", async () => {
      await prisma.block.create({
        data: { blockerId: user.id, blockedId: blockedUser.id },
      });
      await prisma.tweet.create({
        data: {
          id: "t4",
          content: "Blocked tweet",
          userId: blockedUser.id,
          tweetType: "TWEET",
          score: 1,
        },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(
        result.data.find((t) => t.userId === blockedUser.id)
      ).toBeUndefined();
    });

    it("should exclude tweets from muted users", async () => {
      await prisma.mute.create({
        data: { muterId: user.id, mutedId: mutedUser.id },
      });
      await prisma.tweet.create({
        data: {
          id: "t5",
          content: "Muted tweet",
          userId: mutedUser.id,
          tweetType: "TWEET",
          score: 1,
        },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(
        result.data.find((t) => t.userId === mutedUser.id)
      ).toBeUndefined();
    });

    it("should exclude tweets marked not interested", async () => {
      const tweet = await prisma.tweet.create({
        data: {
          id: "t6",
          content: "Not interested tweet",
          userId: user.id,
          tweetType: "TWEET",
          score: 1,
        },
      });
      await prisma.notInterested.create({
        data: { userId: user.id, tweetId: tweet.id },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(result.data.find((t) => t.id === tweet.id)).toBeUndefined();
    });

    it("should exclude tweets reported as spam", async () => {
      const tweet = await prisma.tweet.create({
        data: {
          id: "t7",
          content: "Spam tweet",
          userId: user.id,
          tweetType: "TWEET",
          score: 1,
        },
      });
      await prisma.spamReport.create({
        data: { reporterId: user.id, tweetId: tweet.id, reason: "noreason" },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(result.data.find((t) => t.id === tweet.id)).toBeUndefined();
    });

    it("should paginate with cursor", async () => {
      await prisma.tweet.create({
        data: {
          id: "t8",
          content: "First",
          userId: user.id,
          tweetType: "TWEET",
          score: 10,
        },
      });
      await prisma.tweet.create({
        data: {
          id: "t9",
          content: "Second",
          userId: user.id,
          tweetType: "TWEET",
          score: 9,
        },
      });

      const firstPage = await exploreService.getFeed({
        userId: user.id,
        limit: 1,
      });
      const cursor = encoderService.decode<{ id: string; score: number }>(
        firstPage.cursor as string
      );

      const secondPage = await exploreService.getFeed({
        userId: user.id,
        limit: 1,
        cursor: cursor ?? undefined,
      });
      expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    });

    it("should order tweets by score then id", async () => {
      const t1 = await prisma.tweet.create({
        data: {
          id: "t10",
          content: "High score",
          userId: user.id,
          tweetType: "QUOTE",
          score: 100,
        },
      });
      await prisma.tweet.create({
        data: {
          id: "t11",
          content: "Low score",
          userId: user.id,
          tweetType: "REPLY",
          score: 1,
        },
      });

      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(result.data[0].id).toBe(t1.id);
    });

    it("should return empty feed if no tweets match", async () => {
      await prisma.tweet.deleteMany();
      const result = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
      });
      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });
  });
});
