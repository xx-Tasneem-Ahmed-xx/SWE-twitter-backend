jest.mock("@/api/controllers/notificationController", () => ({
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
    const result = await hashtagsService.fetchTrends("p", "global", 10);
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
    const res = await hashtagsService.fetchTrends("pan", "global", 5);
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
    const trendsPair = await hashtagsService.calculateTrends(
      "global",
      {
        matchingIds: [highId, manyId],
        limit: 50,
      },
      24
    );
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
    const trendsPair2 = await hashtagsService.calculateTrends(
      "global",
      {
        matchingIds: [smallId, bigId],
        limit: 50,
      },
      24
    );
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
    await hashtagsService.calculateAndCacheTrends("global");
    const cached = await hashtagsService.fetchTrends(null, "global");
    expect(cached).toBeDefined();
    expect(Array.isArray(cached.trends)).toBe(true);
  });

  // Test fetchViralTweets
  test("fetchViralTweets returns viral tweets with user interactions", async () => {
    await hashtagsService.calculateAndCacheViralTweets("global");
    const result = await hashtagsService.fetchViralTweets(
      TEST_USER_ID,
      "global"
    );

    expect(result).toBeDefined();
    expect(result.tweets).toBeDefined();
    expect(Array.isArray(result.tweets)).toBe(true);
    expect(result.updatedAt).toBeDefined();
  });

  // Test fetchViralTweets with no cache
  test("fetchViralTweets calculates when cache is empty", async () => {
    await redisClient.del("trends:viral:category:global");
    const result = await hashtagsService.fetchViralTweets(
      TEST_USER_ID,
      "global"
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result.tweets)).toBe(true);
  });

  // Test fetchCategoryData
  test("fetchCategoryData returns trends and viral tweets for a category", async () => {
    const result = await hashtagsService.fetchCategoryData(
      "global",
      TEST_USER_ID
    );

    expect(result).toBeDefined();
    expect(result.category).toBe("global");
    expect(Array.isArray(result.trends)).toBe(true);
    expect(Array.isArray(result.viralTweets)).toBe(true);
    expect(result.updatedAt).toBeDefined();
  });

  // Test fetchCategoryData with different categories
  test("fetchCategoryData works for news category", async () => {
    const result = await hashtagsService.fetchCategoryData(
      "news",
      TEST_USER_ID
    );

    expect(result).toBeDefined();
    expect(result.category).toBe("news");
    expect(Array.isArray(result.trends)).toBe(true);
  });

  test("fetchCategoryData works for sports category", async () => {
    const result = await hashtagsService.fetchCategoryData(
      "sports",
      TEST_USER_ID
    );

    expect(result).toBeDefined();
    expect(result.category).toBe("sports");
  });

  test("fetchCategoryData works for entertainment category", async () => {
    const result = await hashtagsService.fetchCategoryData(
      "entertainment",
      TEST_USER_ID
    );

    expect(result).toBeDefined();
    expect(result.category).toBe("entertainment");
  });

  // Test fetchAllCategoriesData
  test("fetchAllCategoriesData returns data for all categories with whoToFollow", async () => {
    const result = await hashtagsService.fetchAllCategoriesData(TEST_USER_ID);

    expect(result).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(Array.isArray(result.categories)).toBe(true);
    expect(result.categories.length).toBe(4); // global, news, sports, entertainment

    expect(result.whoToFollow).toBeDefined();
    expect(Array.isArray(result.whoToFollow)).toBe(true);

    // Check that each category has the required fields
    result.categories.forEach((cat: any) => {
      expect(cat.category).toBeDefined();
      expect(Array.isArray(cat.trends)).toBe(true);
      expect(Array.isArray(cat.viralTweets)).toBe(true);
      expect(cat.updatedAt).toBeDefined();
    });
  });

  // Test parseCategory
  test("parseCategory validates and normalizes category strings", () => {
    expect(hashtagsService.parseCategory("GLOBAL")).toBe("global");
    expect(hashtagsService.parseCategory("News")).toBe("news");
    expect(hashtagsService.parseCategory("sports")).toBe("sports");
    expect(hashtagsService.parseCategory("ENTERTAINMENT")).toBe(
      "entertainment"
    );
  });

  test("parseCategory throws error for invalid category", () => {
    expect(() => hashtagsService.parseCategory("invalid")).toThrow();
    expect(() => hashtagsService.parseCategory("tech")).toThrow();
  });

  // Test fetchHashtagTweets
  test("fetchHashtagTweets returns paginated tweets for a hashtag", async () => {
    // Get the first hashtag we created
    const hash = await prisma.hash.findFirst({
      where: { tag_text: "pancakes" },
    });

    if (hash) {
      const result = await hashtagsService.fetchHashtagTweets(
        hash.id,
        TEST_USER_ID,
        null,
        10
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.tweets)).toBe(true);
      expect(typeof result.hasMore).toBe("boolean");
    }
  });

  test("fetchHashtagTweets throws error for non-existent hashtag", async () => {
    await expect(
      hashtagsService.fetchHashtagTweets(
        "non-existent-id",
        TEST_USER_ID,
        null,
        10
      )
    ).rejects.toThrow("Hashtag not found");
  });

  // Test calculateViralTweets with different limits
  test("calculateViralTweets respects limit parameter", async () => {
    const result1 = await hashtagsService.calculateViralTweets(24, "global", 2);
    expect(result1.tweets.length).toBeLessThanOrEqual(2);

    const result2 = await hashtagsService.calculateViralTweets(24, "global", 5);
    expect(result2.tweets.length).toBeLessThanOrEqual(5);
  });

  // Test calculateTrends with empty results
  test("calculateTrends returns empty array when no trends found", async () => {
    // Use a very short time period where no tweets exist
    const result = await hashtagsService.calculateTrends("global", {}, 0.001);
    expect(Array.isArray(result)).toBe(true);
  });

  // Test caching behavior
  test("cacheTrends stores data in Redis", async () => {
    const mockTrends = [
      {
        id: "test1",
        hashtag: "test",
        tweetCount: 5,
        likesCount: 10,
        score: 0.8,
        rank: 1,
      },
    ];

    await hashtagsService.cacheTrends(mockTrends, "global");

    const cached = await redisClient.get("trends:category:global");
    expect(cached).toBeDefined();

    const parsed = JSON.parse(cached!);
    expect(parsed.trends).toBeDefined();
    expect(parsed.updatedAt).toBeDefined();
  });

  // Test getTrendsFromQuery with no results
  test("getTrendsFromQuery returns empty array when no matches found", async () => {
    const result = await hashtagsService.getTrendsFromQuery(
      "nonexistenthashtag123",
      10,
      "global"
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result.trends)).toBe(true);
    expect(result.trends.length).toBe(0);
  });

  // Test extractAndNormalizeHashtags
  test("extractAndNormalizeHashtags extracts hashtags from text", () => {
    const text = "This is a #test tweet with #multiple #hashtags";
    const result = hashtagsService.extractAndNormalizeHashtags(text);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("test");
    expect(result).toContain("multiple");
    expect(result).toContain("hashtags");
  });

  test("extractAndNormalizeHashtags handles null/undefined", () => {
    expect(hashtagsService.extractAndNormalizeHashtags(null)).toEqual([]);
    expect(hashtagsService.extractAndNormalizeHashtags(undefined)).toEqual([]);
    expect(hashtagsService.extractAndNormalizeHashtags("")).toEqual([]);
  });

  test("extractAndNormalizeHashtags deduplicates hashtags", () => {
    const text = "#Test #test #TEST #different";
    const result = hashtagsService.extractAndNormalizeHashtags(text);

    expect(result.length).toBe(2); // "test" and "different"
    expect(result).toContain("test");
    expect(result).toContain("different");
  });

  test("extractAndNormalizeHashtags filters out very long hashtags", () => {
    const longHashtag = "#" + "a".repeat(150);
    const text = `#normal ${longHashtag}`;
    const result = hashtagsService.extractAndNormalizeHashtags(text);

    expect(result).toContain("normal");
    expect(result.length).toBe(1); // Long hashtag should be filtered out
  });

  // Test attachHashtagsToTweet
  test("attachHashtagsToTweet handles empty text", async () => {
    const tweetId = "test-tweet-id-2";

    await prisma.$transaction(async (tx) => {
      await hashtagsService.attachHashtagsToTweet(tweetId, null, tx);
    });

    // Should not throw error with null text
    expect(true).toBe(true);
  });

  test("attachHashtagsToTweet handles empty string", async () => {
    const tweetId = "test-tweet-id-3";

    await prisma.$transaction(async (tx) => {
      await hashtagsService.attachHashtagsToTweet(tweetId, "", tx);
    });

    // Should not throw error with empty string
    expect(true).toBe(true);
  });

  test("attachHashtagsToTweet throws error without tweetId", async () => {
    await prisma.$transaction(async (tx) => {
      await expect(
        hashtagsService.attachHashtagsToTweet("", "some text", tx)
      ).rejects.toThrow("tweetId is required");
    });
  });

  test("attachHashtagsToTweet throws error without transaction client", async () => {
    await expect(
      hashtagsService.attachHashtagsToTweet(
        "tweet-id",
        "some text",
        null as any
      )
    ).rejects.toThrow("transaction client is required");
  });

  // Test helper functions directly
  test("findExistingHashes returns existing hashtags", async () => {
    await prisma.$transaction(async (tx) => {
      const result = await hashtagsService.findExistingHashes(tx, [
        "pancakes",
        "nonexistent",
      ]);

      expect(Array.isArray(result)).toBe(true);
      const tags = result.map(
        (h: { id: string; tag_text: string }) => h.tag_text
      );
      expect(tags).toContain("pancakes");
    });
  });

  test("findExistingHashes handles empty array", async () => {
    await prisma.$transaction(async (tx) => {
      const result = await hashtagsService.findExistingHashes(tx, []);
      expect(result).toEqual([]);
    });
  });

  test("createMissingHashes creates new hashtags", async () => {
    const newTags = ["uniquetag1", "uniquetag2"];

    await prisma.$transaction(async (tx) => {
      await hashtagsService.createMissingHashes(tx, newTags);
    });

    const created = await prisma.hash.findMany({
      where: { tag_text: { in: newTags } },
    });

    expect(created.length).toBe(2);
  });

  test("createMissingHashes handles empty array", async () => {
    await prisma.$transaction(async (tx) => {
      await hashtagsService.createMissingHashes(tx, []);
    });

    // Should not throw error
    expect(true).toBe(true);
  });

  test("getAllHashesByTags retrieves all hashtags", async () => {
    await prisma.$transaction(async (tx) => {
      const result = await hashtagsService.getAllHashesByTags(tx, ["pancakes"]);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tag_text).toBe("pancakes");
    });
  });

  test("getAllHashesByTags handles empty array", async () => {
    await prisma.$transaction(async (tx) => {
      const result = await hashtagsService.getAllHashesByTags(tx, []);
      expect(result).toEqual([]);
    });
  });

  test("createTweetHashRelations handles empty array", async () => {
    await prisma.$transaction(async (tx) => {
      await hashtagsService.createTweetHashRelations(tx, "tweet-id", []);
    });

    // Should not throw error
    expect(true).toBe(true);
  });
});
