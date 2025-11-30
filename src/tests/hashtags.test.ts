import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
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
      where: { tag_text: "prayingfononemptylist" },
      update: {},
      create: { id: HASH_IDS[0], tag_text: "prayingfononemptylist" },
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
        likesCount: 0,
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
        likesCount: 0,
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
        likesCount: 0,
        retweetCount: 0,
        repliesCount: 0,
        quotesCount: 0,
        replyControl: "EVERYONE",
        tweetType: "TWEET",
      },
    });

    TWEET_IDS.push(recent1.id, recent2.id, recent3.id);

    await prisma.tweetHash.create({
      data: { tweetId: recent1.id, hashId: HASH_IDS[1] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent2.id, hashId: HASH_IDS[1] },
    });
    await prisma.tweetHash.create({
      data: { tweetId: recent3.id, hashId: HASH_IDS[2] },
    });
  });

  afterAll(async () => {
    await prisma.tweetHash.deleteMany({
      where: { tweetId: { in: TWEET_IDS } },
    });
    await prisma.tweet.deleteMany({ where: { id: { in: TWEET_IDS } } });
    await prisma.hash.deleteMany({ where: { id: { in: HASH_IDS } } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  // Ensure that autocomplete returns matching hashtags ordered by tweet count
  test("autocomplete includes zero-count matches and orders by count desc", async () => {
    const result = await hashtagsService.fetchTrends(10, "p");
    expect(result).toBeDefined();
    const names = result.trends.map((t: any) => t.hashtag);

    expect(names).toContain("pancakes");
    expect(names).toContain("python");
    expect(names).toContain("prayingfononemptylist");

    // ordering according to tweet counts: pancakes (2), python (1), prayingfononemptylist (0)
    const idxPancakes = names.indexOf("pancakes");
    const idxPython = names.indexOf("python");
    const idxPray = names.indexOf("prayingfononemptylist");

    expect(idxPancakes).toBeGreaterThanOrEqual(0);
    expect(idxPython).toBeGreaterThanOrEqual(0);
    expect(idxPray).toBeGreaterThanOrEqual(0);

    expect(idxPancakes).toBeLessThan(idxPython);
    expect(idxPython).toBeLessThan(idxPray);
  });

  // Ensure that cached trends are used when no query is provided
  test("no query uses cached/global trends when available", async () => {
    await hashtagsService.calculateAndCacheTrends();
    const cached = await hashtagsService.fetchTrends(10);
    expect(cached).toBeDefined();
    expect(Array.isArray(cached.trends)).toBe(true);
  });
});
