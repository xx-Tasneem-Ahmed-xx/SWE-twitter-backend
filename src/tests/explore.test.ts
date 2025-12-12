import { initRedis, redisClient } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
import { ExploreService } from "@/application/services/explore";
import {
  encoderService,
  initEncoderService,
} from "@/application/services/encoder";
import z from "zod";
import { User } from "@prisma/client";
import { redis } from "@/application/services/timeline";
import { RESPONSES } from "@/application/constants/responses";
import { checkUserInteractions } from "@/application/utils/tweet.utils";
let connectToDatabase: any;
const exploreService = ExploreService.getInstance();

jest.mock("@/application/services/notification", () => ({
  addNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/application/utils/tweet.utils", () => {
  const actual = jest.requireActual("@/application/utils/tweet.utils");
  return {
    ...actual,
    checkUserInteractions: jest.fn((tweets) => tweets),
  };
});

beforeAll(async () => {
  await initRedis();
  await loadSecrets();
  await initEncoderService();
  connectToDatabase = (await import("@/database")).connectToDatabase;
});
let user: User, user2: User, mutedUser: User, blockedUser: User;

const CAT1 = "sports";
const CAT2 = "news";
const CAT3 = "tech";

describe("ExploreService", () => {
  let tweetId: string;
  beforeAll(async () => {
    await connectToDatabase();

    user = await prisma.user.upsert({
      where: { username: "test_user1" },
      update: {},
      create: {
        username: "test_user1",
        email: "test_user1@example.com",
        password: "password456",
        saltPassword: "salt456",
        name: "Test User One",
      },
    });
    user2 = await prisma.user.upsert({
      where: { username: "test_user2" },
      update: {},
      create: {
        username: "test_user2",
        email: "test_user2@example.com",
        password: "password456",
        saltPassword: "salt456",
        name: "Test User Two",
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
    await prisma.block.create({
      data: { blockerId: user.id, blockedId: blockedUser.id },
    });
    await prisma.mute.create({
      data: { muterId: user.id, mutedId: mutedUser.id },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [user.id, user2.id, mutedUser.id, blockedUser.id] } },
    });
    await prisma.category.deleteMany({
      where: { name: { in: [CAT1, CAT2, CAT3] } },
    });
    await prisma.tweet.deleteMany({
      where: {
        userId: { in: [user.id, user2.id, mutedUser.id, blockedUser.id] },
      },
    });
    await redis.flushall();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await redis.flushall();
    await prisma.category.upsert({
      where: { name: CAT1 },
      update: {},
      create: { name: CAT1 },
    });

    await prisma.category.upsert({
      where: { name: CAT2 },
      update: {},
      create: { name: CAT2 },
    });

    await prisma.category.upsert({
      where: { name: CAT3 },
      update: {},
      create: { name: CAT3 },
    });
    const tweet = await prisma.tweet.create({
      data: {
        content: "Hello world",
        userId: user.id,
        tweetType: "TWEET",
        likesCount: 10,
        retweetCount: 5,
        quotesCount: 2,
        repliesCount: 3,
        tweetCategories: {
          create: [{ category: { connect: { name: CAT1 } } }],
        },
      },
    });
    tweetId = tweet.id;
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
      const dto = { categories: [CAT1] };
      const result = await exploreService.saveUserPreferredCategories(
        user.id,
        dto
      );

      expect(result.id).toBe(user.id);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferredCategories: true },
      });
      expect(updatedUser?.preferredCategories.map((c) => c.name)).toContain(
        CAT1
      );
    });

    it("should save multiple preferred categories", async () => {
      const dto = { categories: [CAT1, CAT2] };
      await exploreService.saveUserPreferredCategories(user.id, dto);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { preferredCategories: true },
      });
      expect(updatedUser?.preferredCategories.length).toBe(2);
    });

    it("should throw ZodError if no categories provided", async () => {
      const dto = { categories: [] };

      await expect(
        exploreService.saveUserPreferredCategories(user.id, dto)
      ).rejects.toThrow(z.ZodError);
    });

    it("should throw error if category does not exist", async () => {
      const dto = { categories: ["nonexistent"] };
      await expect(
        exploreService.saveUserPreferredCategories(user.id, dto)
      ).rejects.toThrow();
    });

    it("should throw error if user does not exist", async () => {
      const dto = { categories: [CAT1] };
      await expect(
        exploreService.saveUserPreferredCategories("fake-user", dto)
      ).rejects.toThrow();
    });
  });

  describe("getUserPreferredCategories", () => {
    it("should return user preferred categories", async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferredCategories: {
            set: [],
            connect: [{ name: CAT1 }, { name: CAT3 }],
          },
        },
        select: { id: true },
      });

      const res = await exploreService.getUserPreferredCategories(user.id);
      expect(res).toEqual({
        preferredCategories: [{ name: CAT1 }, { name: CAT3 }],
      });
    });

    it("should return empty array if user has no preferred categories", async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferredCategories: {
            deleteMany: {},
          },
        },
        select: { id: true },
      });
      const res = await exploreService.getUserPreferredCategories(user.id);

      expect(res).toEqual({
        preferredCategories: [],
      });
    });

    it("should throw NOT_FOUND if user does not exist", async () => {
      await expect(
        exploreService.getUserPreferredCategories("invalid-id")
      ).rejects.toThrow(RESPONSES.ERRORS.NOT_FOUND.message);
    });
  });

  describe("calculateTweetScore", () => {
    it("calculates and updates score, populates global and category feeds", async () => {
      await exploreService.calculateTweetScore(tweetId);

      const updatedTweet = await prisma.tweet.findUnique({
        where: { id: tweetId },
      });
      expect(updatedTweet?.score).toBeGreaterThan(0);

      const globalScore = await redisClient.zScore("explore:global", tweetId);
      expect(globalScore).toBeCloseTo(updatedTweet!.score);

      const catScore = await redisClient.zScore(
        `explore:category:${CAT1}`,
        tweetId
      );
      expect(catScore).toBeCloseTo(updatedTweet!.score);
    });

    it("does nothing if tweet does not exist", async () => {
      await expect(
        exploreService.calculateTweetScore("nonexistent")
      ).resolves.toBeUndefined();
    });
  });

  describe("refreshCategoryFeed", () => {
    it("populates Redis with tweets in order of score", async () => {
      await exploreService.calculateTweetScore(tweetId);
      await exploreService.refreshCategoryFeed(CAT1);

      const zrange = await redisClient.zRange(
        `explore:category:${CAT1}`,
        0,
        -1,
        { REV: true }
      );
      expect(zrange).toContain(tweetId);
    });

    it("handles empty category gracefully", async () => {
      await prisma.tweet.deleteMany({});
      await exploreService.refreshCategoryFeed(CAT1);

      const zrange = await redisClient.zRange(
        `explore:category:${CAT1}`,
        0,
        -1
      );
      expect(zrange.length).toBe(0);
    });

    it("works with multiple pages (pipelineSize)", async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.tweet.create({
          data: {
            content: `t${i}`,
            userId: user.id,
            tweetType: "TWEET",
            score: i,
            tweetCategories: {
              create: [{ category: { connect: { name: CAT2 } } }],
            },
          },
        });
      }
      await exploreService.refreshCategoryFeed(CAT2, 2);

      const zrange = await redisClient.zRange(
        `explore:category:${CAT2}`,
        0,
        -1
      );
      expect(zrange.length).toBe(5);
    });
  });

  describe("hydrateTweets", () => {
    beforeAll(async () => {
      await prisma.tweet.create({
        data: {
          id: "h1",
          userId: user.id,
          content: "first tweet",
          tweetType: "REPLY",
          score: 10,
        },
      });

      await prisma.tweet.create({
        data: {
          id: "h2",
          userId: user.id,
          content: "second tweet",
          tweetType: "QUOTE",
          score: 20,
        },
      });

      await prisma.tweet.create({
        data: {
          id: "h3",
          userId: user.id,
          content: "third tweet",
          tweetType: "TWEET",
          score: 30,
        },
      });
    });

    it("should hydrate tweets in the same order as ids", async () => {
      const res = await exploreService["hydrateTweets"](user.id, [
        "h2",
        "h1",
        "h3",
      ]);

      expect(res.map((t) => t.id)).toEqual(["h2", "h1", "h3"]);
      expect(checkUserInteractions).toHaveBeenCalledWith(res);
    });

    it("should filter out non-existent tweet ids", async () => {
      const res = await exploreService["hydrateTweets"](user.id, [
        "h1",
        "invalid",
        "h3",
      ]);

      expect(res.map((t) => t.id)).toEqual(["h1", "h3"]);
    });

    it("should return empty array if no ids provided", async () => {
      const res = await exploreService["hydrateTweets"](user.id, []);
      expect(res).toEqual([]);
    });

    it("should return empty array if none of the ids exist", async () => {
      const res = await exploreService["hydrateTweets"](user.id, [
        "bad1",
        "bad2",
      ]);
      expect(res).toEqual([]);
    });

    it("should include score field in hydrated tweets", async () => {
      const res = await exploreService["hydrateTweets"](user.id, ["h1"]);
      expect(res[0].score).toBe(10);
    });
  });

  describe("getFeed", () => {
    it("returns tweets for global feed", async () => {
      const tweet = await prisma.tweet.create({
        data: {
          id: "t1",
          content: "Hello world",
          userId: user.id,
          tweetType: "TWEET",
          score: 10,
          tweetCategories: {
            create: [{ category: { connect: { name: CAT1 } } }],
          },
        },
      });

      await exploreService.seedExploreFeeds([tweet.id]);

      const res = await exploreService.getFeed({ userId: user.id, limit: 10 });
      expect(res.data.map((t) => t.id)).toContain(tweet.id);
    });

    it("returns tweets filtered by category", async () => {
      const tweet1 = await prisma.tweet.create({
        data: {
          id: "c1",
          userId: user.id,
          tweetType: "TWEET",
          score: 10,
          content: "Tech tweet",
          tweetCategories: {
            create: [{ category: { connect: { name: CAT3 } } }],
          },
        },
      });
      const tweet2 = await prisma.tweet.create({
        data: {
          id: "c2",
          userId: user.id,
          tweetType: "TWEET",
          score: 5,
          content: "Other tweet",
          tweetCategories: {
            create: [{ category: { connect: { name: CAT2 } } }],
          },
        },
      });

      await exploreService.refreshCategoryFeed(CAT3);

      const res = await exploreService.getFeed({
        userId: user.id,
        limit: 10,
        category: CAT3,
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe(tweet1.id);
    });

    it("excludes tweets from blocked/muted users", async () => {
      const blockedTweet = await prisma.tweet.create({
        data: {
          id: "tb",
          userId: blockedUser.id,
          score: 10,
          tweetType: "TWEET",
          content: "Blocked",
        },
      });
      const mutedTweet = await prisma.tweet.create({
        data: {
          id: "tm",
          userId: mutedUser.id,
          score: 10,
          tweetType: "TWEET",
          content: "Muted",
        },
      });

      await exploreService.seedExploreFeeds([blockedTweet.id, mutedTweet.id]);

      const res = await exploreService.getFeed({ userId: user.id, limit: 10 });
      expect(res.data.find((t) => t.id === "tb")).toBeUndefined();
      expect(res.data.find((t) => t.id === "tm")).toBeUndefined();
    });

    it("paginates using index-based cursor", async () => {
      const t1 = await prisma.tweet.create({
        data: {
          id: "t8",
          userId: user.id,
          score: 10,
          content: "T1",
          tweetType: "TWEET",
        },
      });
      const t2 = await prisma.tweet.create({
        data: {
          id: "t9",
          userId: user.id,
          score: 9,
          content: "T2",
          tweetType: "TWEET",
        },
      });

      await exploreService.seedExploreFeeds([t1.id, t2.id]);

      const first = await exploreService.getFeed({ userId: user.id, limit: 1 });
      const cursor = encoderService.decode<number>(first.cursor as string);

      const second = await exploreService.getFeed({
        userId: user.id,
        limit: 1,
        cursor: cursor ?? undefined,
      });

      expect(first.data[0].id).not.toBe(second.data[0].id);
      expect([first.data[0].id, second.data[0].id]).toEqual(
        expect.arrayContaining([t1.id, t2.id])
      );
    });
  });
});
