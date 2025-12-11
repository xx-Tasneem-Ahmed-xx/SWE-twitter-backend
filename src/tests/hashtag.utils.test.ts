import { prisma } from "@/prisma/client";
import * as utils from "@/application/utils/hashtag.utils";

describe("Hashtag Utils", () => {
  // Test user IDs used across all tests
  const TEST_USER_IDS = [
    "test_user_excluded_ids",
    "blocked_user_1",
    "blocked_user_2",
    "muted_user_1",
    "test_user_filter_tweets",
    "blocked_user_filter",
    "normal_user_filter",
  ];

  const TEST_HASH_IDS = ["test_hash_1", "test_hash_2"];

  // Mock encoder service
  const mockEncoderService = {
    encode: jest.fn((data: any) => `encoded_${JSON.stringify(data)}`),
    decode: jest.fn(),
  };

  // Global cleanup to prevent any data leaks
  afterAll(async () => {
    // Clean up all test users and their relationships
    await prisma.mute.deleteMany({
      where: {
        OR: [
          { muterId: { in: TEST_USER_IDS } },
          { mutedId: { in: TEST_USER_IDS } },
        ],
      },
    });

    await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: TEST_USER_IDS } },
          { blockedId: { in: TEST_USER_IDS } },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: { id: { in: TEST_USER_IDS } },
    });

    // Clean up test hashes
    await prisma.hash.deleteMany({
      where: { id: { in: TEST_HASH_IDS } },
    });

    // Clean up any other test data that might have leaked
    await prisma.user.deleteMany({
      where: {
        OR: [
          { username: { contains: "test_" } },
          { username: { contains: "blocked_" } },
          { username: { contains: "muted_" } },
          { username: { contains: "normal_" } },
          { email: { contains: "@test.com" } },
        ],
      },
    });

    await prisma.hash.deleteMany({
      where: {
        OR: [{ tag_text: { contains: "testhash" } }],
      },
    });

    await prisma.$disconnect();
  });

  describe("buildNextCursor", () => {
    it("should return null when hasMore is false", () => {
      const tweets = [{ id: "1", createdAt: new Date() }];
      const result = utils.buildNextCursor(tweets, false, mockEncoderService);
      expect(result).toBeNull();
    });

    it("should return null when tweets array is empty", () => {
      const result = utils.buildNextCursor([], true, mockEncoderService);
      expect(result).toBeNull();
    });

    it("should return encoded cursor when hasMore is true and tweets exist", () => {
      const tweets = [
        { id: "1", createdAt: new Date("2023-01-01") },
        { id: "2", createdAt: new Date("2023-01-02") },
      ];
      const result = utils.buildNextCursor(tweets, true, mockEncoderService);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(mockEncoderService.encode).toHaveBeenCalled();
    });

    it("should handle tweet without createdAt (use current date)", () => {
      const tweets = [{ id: "1", createdAt: null }];
      const result = utils.buildNextCursor(tweets, true, mockEncoderService);
      expect(result).toBeTruthy();
    });
  });

  describe("buildCursorCondition", () => {
    it("should return empty object when cursor is null", () => {
      const result = utils.buildCursorCondition(null);
      expect(result).toEqual({});
    });

    it("should return empty object when cursor is undefined", () => {
      const result = utils.buildCursorCondition(undefined);
      expect(result).toEqual({});
    });

    it("should return OR condition when cursor is provided", () => {
      const cursor = { id: "123", createdAt: "2023-01-01T00:00:00.000Z" };
      const result = utils.buildCursorCondition(cursor);

      expect(result).toHaveProperty("OR");
      expect(Array.isArray(result.OR)).toBe(true);
      expect(result.OR).toHaveLength(2);
    });
  });

  // viralScore and sortByViral tests removed - these functions were moved to explore service
  // describe("viralScore", () => { ... });
  // describe("sortByViral", () => { ... });

  describe("calculateTrendScores", () => {
    it("should calculate normalized scores", () => {
      const entries = [
        { hashId: "1", tweetCount: 10, likesSum: 100 },
        { hashId: "2", tweetCount: 5, likesSum: 50 },
      ];
      const result = utils.calculateTrendScores(entries);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThan(result[1].score);
      expect(result[0].score).toBeLessThanOrEqual(1);
    });

    it("should handle zero max values", () => {
      const entries = [{ hashId: "1", tweetCount: 0, likesSum: 0 }];
      const result = utils.calculateTrendScores(entries);

      expect(result[0].score).toBe(0);
    });
  });

  describe("sortAndTake", () => {
    it("should sort by score and limit results", () => {
      const entries = [
        { score: 0.5 },
        { score: 0.9 },
        { score: 0.3 },
        { score: 0.7 },
      ];
      const result = utils.sortAndTake(entries, 2);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(0.9);
      expect(result[1].score).toBe(0.7);
    });
  });

  describe("getExcludedUserIds", () => {
    const testUserId = "test_user_excluded_ids";

    beforeAll(async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            id: testUserId,
            username: "test_excluded",
            email: "test_excluded@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Test User",
          },
          {
            id: "blocked_user_1",
            username: "blocked_1",
            email: "blocked1@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Blocked User 1",
          },
          {
            id: "blocked_user_2",
            username: "blocked_2",
            email: "blocked2@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Blocked User 2",
          },
          {
            id: "muted_user_1",
            username: "muted_1",
            email: "muted1@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Muted User 1",
          },
        ],
      });

      // Create block relationships
      await prisma.block.createMany({
        data: [
          { blockerId: testUserId, blockedId: "blocked_user_1" },
          { blockerId: "blocked_user_2", blockedId: testUserId },
        ],
      });

      // Create mute relationship
      await prisma.mute.create({
        data: { muterId: testUserId, mutedId: "muted_user_1" },
      });
    });

    afterAll(async () => {
      await prisma.mute.deleteMany({ where: { muterId: testUserId } });
      await prisma.block.deleteMany({
        where: {
          OR: [{ blockerId: testUserId }, { blockedId: testUserId }],
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              testUserId,
              "blocked_user_1",
              "blocked_user_2",
              "muted_user_1",
            ],
          },
        },
      });
    });

    it("should return all excluded user IDs (blocked and muted)", async () => {
      const excluded = await utils.getExcludedUserIds(testUserId, prisma);

      expect(excluded).toContain("blocked_user_1"); // I blocked
      expect(excluded).toContain("blocked_user_2"); // Blocked me
      expect(excluded).toContain("muted_user_1"); // I muted
      expect(excluded).toHaveLength(3);
    });

    it("should return empty array when no blocks or mutes exist", async () => {
      const excluded = await utils.getExcludedUserIds(
        "nonexistent_user",
        prisma
      );
      expect(excluded).toEqual([]);
    });
  });

  describe("filterBlockedAndMutedTweets", () => {
    const testUserId = "test_user_filter_tweets";
    const blockedUserId = "blocked_user_filter";
    const normalUserId = "normal_user_filter";

    beforeAll(async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            id: testUserId,
            username: "test_filter",
            email: "test_filter@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Test User",
          },
          {
            id: blockedUserId,
            username: "blocked_filter",
            email: "blocked_filter@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Blocked User",
          },
          {
            id: normalUserId,
            username: "normal_filter",
            email: "normal_filter@test.com",
            password: "pass",
            saltPassword: "salt",
            dateOfBirth: new Date("2000-01-01"),
            name: "Normal User",
          },
        ],
      });

      // Block one user
      await prisma.block.create({
        data: { blockerId: testUserId, blockedId: blockedUserId },
      });
    });

    afterAll(async () => {
      await prisma.block.deleteMany({ where: { blockerId: testUserId } });
      await prisma.user.deleteMany({
        where: { id: { in: [testUserId, blockedUserId, normalUserId] } },
      });
    });

    it("should filter out tweets from blocked users", async () => {
      const tweets = [
        { id: "1", userId: normalUserId, content: "Normal tweet" },
        { id: "2", userId: blockedUserId, content: "Blocked tweet" },
        { id: "3", userId: normalUserId, content: "Another normal tweet" },
      ];

      const filtered = await utils.filterBlockedAndMutedTweets(
        tweets,
        testUserId,
        prisma
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
    });

    it("should return empty array when input is empty", async () => {
      const filtered = await utils.filterBlockedAndMutedTweets(
        [],
        testUserId,
        prisma
      );
      expect(filtered).toEqual([]);
    });

    it("should return all tweets when no blocks/mutes exist", async () => {
      const tweets = [
        { id: "1", userId: normalUserId, content: "Normal tweet" },
      ];

      const filtered = await utils.filterBlockedAndMutedTweets(
        tweets,
        "other_user",
        prisma
      );

      expect(filtered).toHaveLength(1);
    });
  });

  describe("mapToTrendData", () => {
    const testHashId1 = "test_hash_1";
    const testHashId2 = "test_hash_2";

    beforeAll(async () => {
      await prisma.hash.createMany({
        data: [
          { id: testHashId1, tag_text: "testhash1" },
          { id: testHashId2, tag_text: "testhash2" },
        ],
      });
    });

    afterAll(async () => {
      await prisma.hash.deleteMany({
        where: { id: { in: [testHashId1, testHashId2] } },
      });
    });

    it("should map entries to TrendData with ranks", async () => {
      const entries = [
        { hashId: testHashId1, tweetCount: 10, likesSum: 100, score: 0.9 },
        { hashId: testHashId2, tweetCount: 5, likesSum: 50, score: 0.7 },
      ];

      const result = await utils.mapToTrendData(entries, prisma);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: testHashId1,
        hashtag: "testhash1",
        tweetCount: 10,
        likesCount: 100,
        score: 0.9,
        rank: 1,
      });
      expect(result[1].rank).toBe(2);
    });

    it("should return empty array when entries is empty", async () => {
      const result = await utils.mapToTrendData([], prisma);
      expect(result).toEqual([]);
    });

    it("should filter out entries with non-existent hashIds", async () => {
      const entries = [
        {
          hashId: "nonexistent_hash",
          tweetCount: 10,
          likesSum: 100,
          score: 0.9,
        },
      ];

      const result = await utils.mapToTrendData(entries, prisma);
      expect(result).toEqual([]);
    });
  });
});
