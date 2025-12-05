// src/tests/timeline.test.ts
// --- 1. DEFINE PLACEHOLDERS AND MOCK FUNCTIONS ---
let mockPrisma: any;
let mockRedis: any;
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockQueryRaw = jest.fn();
const mockTransaction = jest.fn();
const mockSpamReportGroupBy = jest.fn();

// --- 2. MOCK PRISMA (Self-Contained Definition) ---
jest.mock("@/prisma/client", () => {
  mockPrisma = {
    follow: { findMany: mockFindMany },
    mute: { findMany: mockFindMany },
    block: { findMany: mockFindMany },
    notInterested: { findMany: mockFindMany },
    spamReport: { groupBy: mockSpamReportGroupBy },
    tweet: { findMany: mockFindMany, findUnique: mockFindUnique },
    $queryRaw: mockQueryRaw,
    $transaction: mockTransaction,
  };
  return { prisma: mockPrisma };
});

// --- 3. MOCK IOREDIS ---
jest.mock("ioredis", () => {
  mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };
  return {
    __esModule: true,
    default: jest.fn(() => mockRedis),
  };
});

// --- 4. IMPORT (Must follow mocks) ---
import {
  TimelineService,
  recencyScore,
} from "../application/services/timeline";

// --- DEFERRED SERVICE INSTANCES & CONSTANTS ---
let service: TimelineService;
let TimelineServiceClass: typeof TimelineService;
const MOCK_USER_ID = "user-test-123";
const MOCK_FOLLOWING_ID = "user-following-001";
const MOCK_TWEET_ID = "tweet-test-101";
const MOCK_PARENT_ID = "tweet-parent-100";
const mockFindFollow = mockPrisma.follow.findMany;
const mockFindBlock = mockPrisma.block.findMany;
const mockFindUniqueTweet = mockPrisma.tweet.findUnique;
const mockQueryRawFn = mockPrisma.$queryRaw;
const mockFindTweets = mockPrisma.tweet.findMany;

// --- MOCK DATA FACTORIES & CACHE (CRITICAL FIX) ---
const RAW_CANDIDATE_CACHE: Record<string, any> = {};

const mockRawCandidate = (
  id: string,
  userId: string,
  type: "TWEET" | "QUOTE" | "REPLY" = "TWEET",
  parentId: string | null = null,
  scoreBoost = 0
) => {
  const candidate = {
    id,
    userId,
    content: `Raw content for ${id}`,
    // Set a consistent old time for score calculation
    createdAt: new Date(Date.now() - 100000000).toISOString(),
    likes: 500 + scoreBoost,
    rts: 100 + scoreBoost,
    replies: 50 + scoreBoost,
    quotes: 10 + scoreBoost,
    replyControl: "EVERYONE",
    parentId: parentId,
    tweetType: type,
    likes_recent: 50 + scoreBoost,
    rts_recent: 10 + scoreBoost,
    reputation: 1.0,
    verified: true,
    tags: ["test", "mock"],
    username: "raw_user",
    name: "Raw User",
    profileMediaId: "raw-media-id",
    protectedAccount: false,
  };
  RAW_CANDIDATE_CACHE[id] = candidate; // Store candidate in cache
  return candidate;
};

const mockQueryRawCandidates = (
  count: number,
  startId = 1,
  fixedAuthorId?: string
): any[] => {
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const id = `candidate-${startId + i}`;
    // FIX: Ensure unique author IDs if no fixedAuthorId is provided, addressing diversity issues.
    const authorId = fixedAuthorId ?? `author-candidate-unique-${startId + i}`;
    candidates.push({
      // Ensure the mockRawCandidate call happens here to populate the cache
      ...mockRawCandidate(id, authorId),
      reason: "global",
    });
  }
  return candidates;
};

const mockFullTweetFindMany = (candidates: any[]): any[] => {
  return candidates.map((c) => ({
    id: c.id,
    userId: c.userId,
    content: `Full: ${c.content}`,
    createdAt: c.createdAt,
    likesCount: c.likes,
    retweetCount: c.rts,
    repliesCount: c.replies,
    quotesCount: c.quotes,
    replyControl: c.replyControl,
    parentId: c.parentId || null,
    tweetType: c.tweetType,
    user: {
      id: c.userId,
      username: c.username,
      name: c.name,
      verified: c.verified,
      protectedAccount: c.protectedAccount,
      profileMedia: c.profileMediaId ? { id: c.profileMediaId } : null,
    },
    tweetMedia: [{ mediaId: "media-A" }],
    // Simulate isLiked logic based on high boost/likes in the raw data
    tweetLikes: c.likes > 1000 ? [{ userId: MOCK_USER_ID }] : [],
    retweets: [],
    tweetBookmark: [],
  }));
};

// --- TESTS ---
describe("TimelineService", () => {
  beforeAll(async () => {
    TimelineServiceClass = TimelineService;
    service = new TimelineServiceClass();
    mockTransaction.mockImplementation(
      async (callback: any) => await callback(mockPrisma)
    );
  });

  beforeEach(() => {
    // Clear cache and reset mocks
    Object.keys(RAW_CANDIDATE_CACHE).forEach(
      (key) => delete RAW_CANDIDATE_CACHE[key]
    );

    service = new TimelineServiceClass();
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockFindFollow.mockResolvedValue([{ followingId: MOCK_FOLLOWING_ID }]);
    mockFindBlock.mockResolvedValue([]);
    mockSpamReportGroupBy.mockResolvedValue([]);
    mockFindUniqueTweet.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValue([]);

    // Default mock for mockFindTweets (CRITICAL FIX: Hydration step)
    mockFindTweets.mockImplementation(async ({ where }: any) => {
      const ids: string[] = where?.id?.in || [];
      if (ids.length > 0) {
        const candidatesToHydrate = ids.map((id) => {
          // Retrieve the specific raw candidate data from cache
          if (RAW_CANDIDATE_CACHE[id]) {
            return RAW_CANDIDATE_CACHE[id];
          }
          // Fallback to avoid breaking if an ID is not cached
          return mockRawCandidate(id, `author-fallback-${id}`);
        });

        return mockFullTweetFindMany(candidatesToHydrate);
      }
      return [];
    });

    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  // --- Utility Function Tests (Shallow) ---
  describe("Math Helpers", () => {
    it("should correctly calculate recency score", () => {
      const halfLifeHours = 24;
      const now = Date.now();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const score = recencyScore(oneDayAgo, halfLifeHours);
      expect(score).toBeCloseTo(0.5);
      const nowScore = recencyScore(new Date(now), halfLifeHours);
      expect(nowScore).toBeCloseTo(1.0);
    });
  });

  // --- getTimeline (Following Feed) Tests ---
  describe("getTimeline", () => {
    it("should return empty feed if user follows no one and cache is cold", async () => {
      mockFindFollow.mockResolvedValue([]);
      const result = await service.getTimeline({ userId: MOCK_USER_ID });
      expect(result.items).toEqual([]);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });
  });

  // --- getForYou Tests ---
  describe("getForYou", () => {
    const mockTwoHopId = "user-twohop-002";
    beforeEach(() => {
      // Setup the specific candidate ('t-10') and generic candidates, populating the cache
      const followedCandidate = mockRawCandidate(
        "t-10",
        MOCK_FOLLOWING_ID, // MOCK_FOLLOWING_ID is the expected user
        "TWEET",
        null,
        2000
      );
      // Generate unique authors for generic candidates
      const genericCandidates = mockQueryRawCandidates(29, 1000);

      // Mock $queryRaw
      mockQueryRawFn.mockImplementation(
        (strings: TemplateStringsArray, ...values: unknown[]) => {
          const query = strings.join("");
          if (query.includes('FROM "Follow" f1 JOIN "Follow" f2')) {
            return Promise.resolve([{ followingId: mockTwoHopId }]);
          }
          return Promise.resolve([followedCandidate, ...genericCandidates]);
        }
      );
    });

    it("should return a feed with both items and recommendations fields populated", async () => {
      const result = await service.getForYou({
        userId: MOCK_USER_ID,
        limit: 10,
      });
      expect(result.items.length).toBe(10);
      expect(result.recommendations).toEqual(result.items);
      expect(result.user).toBe(MOCK_USER_ID);
    });

    it("should use cached response if available", async () => {
      const cachedResponse = {
        user: MOCK_USER_ID,
        items: [
          {
            id: "cached-1",
            content: "Cached Content",
            createdAt: new Date().toISOString(),
            likesCount: 0,
            retweetCount: 0,
            repliesCount: 0,
            quotesCount: 0,
            replyControl: "EVERYONE",
            tweetType: "TWEET",
            mediaIds: [],
            isLiked: false,
            isRetweeted: false,
            isBookmarked: false,
            score: 1.0,
            reasons: ["cache"],
            user: {
              id: "author-cached-1",
              name: "Cached User",
              username: "c-user",
              verified: false,
              protectedAccount: false,
              profileMedia: null,
            },
          },
        ],
        recommendations: [],
        nextCursor: null,
        generatedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));
      const result = await service.getForYou({
        userId: MOCK_USER_ID,
        limit: 10,
      });
      expect(result.items.length).toBe(1);
      expect(mockQueryRawFn).not.toHaveBeenCalled();
    });

    it("should verify candidates from a followed user are processed", async () => {
      const result = await service.getForYou({
        userId: MOCK_USER_ID,
        limit: 2,
      });
      expect(result.items.map((i) => i.user.id)).toContain(MOCK_FOLLOWING_ID);
    });
  });
});
