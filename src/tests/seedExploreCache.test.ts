import { prisma } from "@/prisma/client";
import { seedExploreCache } from "@/jobScripts/seedExplore";
import { enqueueSeedExploreFeedJob } from "@/background/jobs/explore";
import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";

jest.mock("@/background/jobs/explore", () => ({
  enqueueSeedExploreFeedJob: jest.fn().mockResolvedValue(undefined),
}));

let connectToDatabase: any;

beforeAll(async () => {
  await initRedis();
  await loadSecrets();
  connectToDatabase = (await import("@/database")).connectToDatabase;
  await connectToDatabase();
});

describe("seedExploreCache", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        username: `seed_test_user_${Date.now()}`,
        email: `seedtest_${Date.now()}@example.com`,
        password: "password123",
        saltPassword: "salt123",
        name: "Seed Test User",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: userId },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all tweet IDs and enqueue seed job", async () => {
    const tweet1 = await prisma.tweet.create({
      data: {
        content: "Seed test tweet 1",
        userId,
        tweetType: "TWEET",
      },
    });

    const tweet2 = await prisma.tweet.create({
      data: {
        content: "Seed test tweet 2",
        userId,
        tweetType: "TWEET",
      },
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    await seedExploreCache();

    expect(enqueueSeedExploreFeedJob).toHaveBeenCalledTimes(1);
    expect(enqueueSeedExploreFeedJob).toHaveBeenCalledWith({
      tweetIds: expect.arrayContaining([tweet1.id, tweet2.id]),
    });

    const callArgs = (enqueueSeedExploreFeedJob as jest.Mock).mock.calls[0][0];
    expect(callArgs.tweetIds.length).toBeGreaterThanOrEqual(2);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Enqueued seed job for`)
    );

    consoleSpy.mockRestore();

    await prisma.tweet.deleteMany({
      where: { id: { in: [tweet1.id, tweet2.id] } },
    });
  });

  it("should handle empty database gracefully", async () => {
    await prisma.tweet.deleteMany({});

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    await seedExploreCache();

    expect(enqueueSeedExploreFeedJob).toHaveBeenCalledWith({
      tweetIds: [],
    });

    expect(consoleSpy).toHaveBeenCalledWith("Enqueued seed job for 0 tweets");

    consoleSpy.mockRestore();
  });

  it("should enqueue job with correct tweetIds format", async () => {
    const tweet = await prisma.tweet.create({
      data: {
        content: "Format test tweet",
        userId,
        tweetType: "TWEET",
      },
    });

    await seedExploreCache();

    const callArgs = (enqueueSeedExploreFeedJob as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(callArgs.tweetIds)).toBe(true);
    expect(callArgs.tweetIds.every((id: string) => typeof id === "string")).toBe(
      true
    );

    await prisma.tweet.delete({ where: { id: tweet.id } });
  });

  it("should log the correct number of tweets", async () => {
    const tweets = await Promise.all([
      prisma.tweet.create({
        data: { content: "Tweet 1", userId, tweetType: "TWEET" },
      }),
      prisma.tweet.create({
        data: { content: "Tweet 2", userId, tweetType: "TWEET" },
      }),
      prisma.tweet.create({
        data: { content: "Tweet 3", userId, tweetType: "TWEET" },
      }),
    ]);

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    await seedExploreCache();

    const callArgs = (enqueueSeedExploreFeedJob as jest.Mock).mock.calls[0][0];
    const tweetCount = callArgs.tweetIds.length;

    expect(consoleSpy).toHaveBeenCalledWith(
      `Enqueued seed job for ${tweetCount} tweets`
    );

    consoleSpy.mockRestore();

    await prisma.tweet.deleteMany({
      where: { id: { in: tweets.map((t) => t.id) } },
    });
  });
});