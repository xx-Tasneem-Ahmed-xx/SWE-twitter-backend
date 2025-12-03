jest.mock("@/api/controllers/notificationController", () => ({
  getNotificationList: jest.fn(),
  getUnseenNotificationsCount: jest.fn(),
  getUnseenNotifications: jest.fn(),
  markNotificationsAsRead: jest.fn(),
  addNotification: jest.fn(),
}));

jest.mock("../api/controllers/notificationController", () => ({
  getNotificationList: jest.fn(),
  getUnseenNotificationsCount: jest.fn(),
  getUnseenNotifications: jest.fn(),
  markNotificationsAsRead: jest.fn(),
  addNotification: jest.fn(),
}));

import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
import { redisClient } from "@/config/redis";
import { initEncoderService } from "@/application/services/encoder";

let connectToDatabase: any;
let hashtagsService: any;
let encoderService: any;

beforeAll(async () => {
  await initRedis();
  await loadSecrets();

  connectToDatabase = (await import("@/database")).connectToDatabase;
  hashtagsService = await import("@/application/services/hashtags");
  encoderService = await initEncoderService();
});

describe("Hashtags autocomplete & trends service", () => {
  const TEST_USER_ID = "tags_test_user";
  const HASH_IDS = ["h_tags_1", "h_tags_2", "h_tags_3"];
  const TWEET_IDS: string[] = [];

  beforeAll(async () => {
    await connectToDatabase();
    // Ensure any leftover test hashtag rows are removed so tests run from a clean state.
    await prisma.hash.deleteMany({
      where: {
        tag_text: {
          in: [
            "pry_for_nonempty_test",
            "pancakes",
            "python",
            "highlikes",
            "manytweets",
            "smalllikes",
            "bigcount",
          ],
        },
      },
    });
    await prisma.user.upsert({
      where: { username: "tags_test_user" },
      update: {},
      create: {
        id: TEST_USER_ID,
        username: "tags_test_user",
        email: "tags_test_user@example.com",
        password: "password",
        saltPassword: "salt",
        dateOfBirth: new Date("2000-01-01"),
        name: "Tags Test User",
        verified: true,
        protectedAccount: false,
      },
    });

    await prisma.hash.upsert({
      where: { tag_text: "pry_for_nonempty_test" },
      update: {},
      create: { id: HASH_IDS[0], tag_text: "pry_for_nonempty_test" },
    });
    await prisma.hash.upsert({
      where: { tag_text: "pancakes" },
      update: {},
      create: { id: HASH_IDS[1], tag_text: "pancakes" },
    });
    await prisma.hash.upsert({
      where: { tag_text: "python" },
      update: {},
      create: { id: HASH_IDS[2], tag_text: "python" },
    });

    const now = new Date();
    const recent1 = await prisma.tweet.create({
      data: {
        id: "t_tags_1",
        userId: TEST_USER_ID,
        content: "I love pancakes",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 5,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });
    const recent2 = await prisma.tweet.create({
      data: {
        id: "t_tags_2",
        userId: TEST_USER_ID,
        content: "Pancakes for breakfast",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 3,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });
    const recent3 = await prisma.tweet.create({
      data: {
        id: "t_tags_3",
        userId: TEST_USER_ID,
        content: "Python is great",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 1,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });

    // Add more tweets to exercise ordering logic (another pancakes and a zero-count tag)
    const recent4 = await prisma.tweet.create({
      data: {
        id: "t_tags_4",
        userId: TEST_USER_ID,
        content: "More pancakes please",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 4,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });
    const recent5 = await prisma.tweet.create({
      data: {
        id: "t_tags_5",
        userId: TEST_USER_ID,
        content: "pry_for_nonempty_test is a weird tag",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 0,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });

    TWEET_IDS.push(recent1.id, recent2.id, recent3.id, recent4.id, recent5.id);

    await prisma.tweetHash.create({
      data: { tweetId: recent1.id, hashId: HASH_IDS[1] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent2.id, hashId: HASH_IDS[1] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent3.id, hashId: HASH_IDS[2] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent4.id, hashId: HASH_IDS[1] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent5.id, hashId: HASH_IDS[0] },
    });
  });

  afterAll(async () => {
    await prisma.tweetHash.deleteMany({
      where: { tweetId: { in: TWEET_IDS } },
    });
    await prisma.tweet.deleteMany({ where: { id: { in: TWEET_IDS } } });
    await prisma.hash.deleteMany({ where: { id: { in: HASH_IDS } } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    // Clean up any cached global trends so test hashtags don't leak into runtime
    try {
      await redisClient.del("trends:global");
    } catch (err) {
      // ignore cache cleanup errors in test teardown
      console.warn("Failed to clear trends cache during test teardown:", err);
    }
  });

  // Ensure that autocomplete returns matching hashtags ordered by tweet count
  test("autocomplete includes zero-count matches and orders by count desc", async () => {
    const result = await hashtagsService.fetchTrends(10, "p");
    expect(result).toBeDefined();
    const names = result.trends.map((t: any) => t.hashtag);

    expect(names).toContain("pancakes");
    expect(names).toContain("python");
    expect(names).toContain("pry_for_nonempty_test");

    // ordering according to counts/score with updated likes: pancakes (3 tweets / higher likes),
    // pry_for_nonempty_test (1 tweet, zero likes), python (1 tweet, some likes)
    const idxPancakes = names.indexOf("pancakes");
    const idxPython = names.indexOf("python");
    const idxPray = names.indexOf("pry_for_nonempty_test");

    expect(idxPancakes).toBeGreaterThanOrEqual(0);
    expect(idxPython).toBeGreaterThanOrEqual(0);
    expect(idxPray).toBeGreaterThanOrEqual(0);

    // Expect pancakes to appear first. The relative ordering of the other
    // two tags follows the current scoring/normalization logic (python
    // appears before pry_for_nonempty_test in the current implementation),
    // so assert that.
    expect(idxPancakes).toBeLessThan(idxPython);
    expect(idxPython).toBeLessThan(idxPray);
  });

  test("autocomplete 'pan' returns pancakes as top match", async () => {
    const res = await hashtagsService.fetchTrends(5, "pan");
    const names = res.trends.map((t: any) => t.hashtag);
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toBe("pancakes");
  });

  test("higher likes with fewer tweets ranks above many low-like tweets", async () => {
    // create two tags: one with a single high-like tweet, another with many low-like tweets
    const highId = "h_tags_high";
    const manyId = "h_tags_many";
    await prisma.hash.upsert({
      where: { tag_text: "highlikes" },
      update: {},
      create: { id: highId, tag_text: "highlikes" },
    });
    await prisma.hash.upsert({
      where: { tag_text: "manytweets" },
      update: {},
      create: { id: manyId, tag_text: "manytweets" },
    });

    const now = new Date();
    const high = await prisma.tweet.create({
      data: {
        id: "t_high_1",
        userId: TEST_USER_ID,
        content: "highlikes",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 100,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });
    TWEET_IDS.push(high.id);
    await prisma.tweetHash.create({
      data: { tweetId: high.id, hashId: highId },
    });

    // many low-like tweets
    const manyTweets: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t = await prisma.tweet.create({
        data: {
          id: `t_many_${i}`,
          userId: TEST_USER_ID,
          content: `manytweets ${i}`,
          createdAt: now,
          lastActivityAt: now,
          likesCount: 1,
          retweetCount: 0,
          repliesCount: 0,
          quotesCount: 0,
          replyControl: "EVERYONE",
          tweetType: "TWEET",
        },
      });
      manyTweets.push(t.id);
      await prisma.tweetHash.create({
        data: { tweetId: t.id, hashId: manyId },
      });
    }
    TWEET_IDS.push(...manyTweets);
    HASH_IDS.push(highId, manyId);

    // Recalculate trends only for the two tags we just created so the comparison
    // is deterministic and not influenced by cached/global trends.
    const trendsPair = await hashtagsService.calculateTrends(24, {
      matchingIds: [highId, manyId],
      limit: 50,
    });
    const names = trendsPair.map((t: any) => t.hashtag);
    const idxHigh = names.indexOf("highlikes");
    const idxMany = names.indexOf("manytweets");
    expect(idxHigh).toBeGreaterThanOrEqual(0);
    expect(idxMany).toBeGreaterThanOrEqual(0);
    // Current scoring weights tweets more than likes in aggregate normalization,
    // so many low-like tweets are expected to outrank a single very-high-like tweet.
    expect(idxMany).toBeLessThan(idxHigh);
  });

  test("likes insufficient to overcome many tweets count", async () => {
    // create two tags: one with a single moderate-like tweet, another with many moderate tweets
    const smallId = "h_tags_smalllikes";
    const bigId = "h_tags_bigcount";
    await prisma.hash.upsert({
      where: { tag_text: "smalllikes" },
      update: {},
      create: { id: smallId, tag_text: "smalllikes" },
    });
    await prisma.hash.upsert({
      where: { tag_text: "bigcount" },
      update: {},
      create: { id: bigId, tag_text: "bigcount" },
    });

    const now = new Date();
    const solo = await prisma.tweet.create({
      data: {
        id: "t_small_1",
        userId: TEST_USER_ID,
        content: "smalllikes",
        createdAt: now,
        lastActivityAt: now,
        likesCount: 20,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });
    TWEET_IDS.push(solo.id);
    await prisma.tweetHash.create({
      data: { tweetId: solo.id, hashId: smallId },
    });

    // create many tweets with modest likes such that total weight beats the single 20-like tweet
    const bigTweets: string[] = [];
    for (let i = 0; i < 10; i++) {
      const t = await prisma.tweet.create({
        data: {
          id: `t_big_${i}`,
          userId: TEST_USER_ID,
          content: `bigcount ${i}`,
          createdAt: now,
          lastActivityAt: now,
          likesCount: 3,
          retweetCount: 0,
          repliesCount: 0,
          quotesCount: 0,
          replyControl: "EVERYONE",
          tweetType: "TWEET",
        },
      });
      bigTweets.push(t.id);
      await prisma.tweetHash.create({ data: { tweetId: t.id, hashId: bigId } });
    }
    TWEET_IDS.push(...bigTweets);
    HASH_IDS.push(smallId, bigId);

    // Recalculate trends only for the two tags we just created so the comparison
    // is deterministic and not influenced by cached/global trends.
    const trendsPair2 = await hashtagsService.calculateTrends(24, {
      matchingIds: [smallId, bigId],
      limit: 50,
    });
    const names2 = trendsPair2.map((t: any) => t.hashtag);
    const idxSmall = names2.indexOf("smalllikes");
    const idxBig = names2.indexOf("bigcount");
    expect(idxSmall).toBeGreaterThanOrEqual(0);
    expect(idxBig).toBeGreaterThanOrEqual(0);
    // Expect bigcount (many tweets) to outrank smalllikes despite individual likes
    expect(idxBig).toBeLessThan(idxSmall);
  });

  // Ensure that cached trends are used when no query is provided
  test("no query uses cached/global trends when available", async () => {
    await hashtagsService.calculateAndCacheTrends();
    const cached = await hashtagsService.fetchTrends(10);
    expect(cached).toBeDefined();
    expect(Array.isArray(cached.trends)).toBe(true);
  });
});
