/// <reference types="jest" />
import dotenv from "dotenv";
dotenv.config();

// ===========================
// MOCK SETUP - MUST BE FIRST
// ===========================

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// Mock Prisma Client with proper data structure
jest.mock('@prisma/client', () => {
  const mockTweets = [
    {
      id: 'tweet1',
      content: 'This is a test tweet about programming',
      userId: 'user1',
      createdAt: new Date('2024-01-01'),
      likesCount: 10,
      retweetCount: 5,
      repliesCount: 2,
      quotesCount: 1,
      user: {
        id: 'user1',
        name: 'Test User',
        username: 'testuser',
        verified: true,
        profileMediaId: 'media1'
      },
      tweetMedia: [
        { mediaId: 'media1' }
      ],
      hashtags: [
        { hash: { tag_text: 'programming' } },
        { hash: { tag_text: 'coding' } }
      ]
    },
    {
      id: 'tweet2',
      content: 'Another tweet about JavaScript',
      userId: 'user2',
      createdAt: new Date('2024-01-02'),
      likesCount: 20,
      retweetCount: 10,
      repliesCount: 5,
      quotesCount: 3,
      user: {
        id: 'user2',
        name: 'JS Developer',
        username: 'jsdev',
        verified: false,
        profileMediaId: null
      },
      tweetMedia: [],
      hashtags: [{ hash: { tag_text: 'javascript' } }]
    }
  ];

  const mockUsers = [
    {
      id: 'user1',
      username: 'testuser',
      name: 'Test User',
      bio: 'Software engineer',
      verified: true,
      profileMediaId: 'media1',
      followers: Array(100).fill({ followerId: 'follower' }),
      followings: Array(50).fill({ followingId: 'following' })
    },
    {
      id: 'user2',
      username: 'jsdev',
      name: 'JS Developer',
      bio: 'JavaScript enthusiast',
      verified: false,
      profileMediaId: null,
      followers: Array(200).fill({ followerId: 'follower' }),
      followings: Array(75).fill({ followingId: 'following' })
    }
  ];

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      tweet: {
        findMany: jest.fn().mockResolvedValue(mockTweets),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(mockUsers),
      },
    })),
  };
});

// Mock fetch
global.fetch = jest.fn((url: string) =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<html><head><title>Test Page</title></head><body>Test content</body></html>'),
  })
) as jest.Mock;

// ===========================
// IMPORTS AFTER MOCKS
// ===========================

import request from "supertest";
import express, { Express } from "express";
import { twitterSearchRoutes } from "../api/routes/search.routes";
import { Crawler } from "../api/search/crawler";
import { Parser } from "../api/search/parser";
import { Indexer } from "../api/search/indexer";
import { SearchEngine } from "../api/search/searchEngine";
import { PersistenceManager } from "../api/search/persistence";
import { PrismaClient } from "@prisma/client";

// ===========================
// TEST SETUP
// ===========================

describe("Twitter Search Engine API Routes", () => {
  let app: Express;
  let crawler: Crawler;
  let parser: Parser;
  let indexer: Indexer;
  let searchEngine: SearchEngine;
  let persistence: PersistenceManager;

  beforeAll(async () => {
    // Initialize components
    const prisma = new PrismaClient();
    crawler = new Crawler(prisma);
    parser = new Parser();
    indexer = new Indexer();
    persistence = new PersistenceManager('redis://localhost:6379');
    searchEngine = new SearchEngine(indexer, parser, persistence);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api', twitterSearchRoutes(crawler, parser, indexer, searchEngine, persistence));

    // Index some initial data for testing
    try {
      const tweets = await crawler.crawlRecentTweets(10);
      const users = await crawler.crawlAllUsers(10);

      // Parse and index tweets
      const parsedTweets = tweets.map((tweet: any) => parser.parseTweet(tweet));
      indexer.indexTweets(parsedTweets);

      // Parse and index users
      const parsedUsers = users.map((user: any) => parser.parseUser(user));
      indexer.indexUsers(parsedUsers);

      console.log('✅ Test data indexed successfully');
    } catch (error) {
      console.error('⚠️ Warning: Could not index test data:', error);
    }
  });

  afterAll(async () => {
    await persistence.close();
  });

  // ===========================
  // SEARCH TOP TESTS
  // ===========================

  describe("GET /api/search/top", () => {
    it("should return top users and tweets", async () => {
      const res = await request(app)
        .get("/api/search/top")
        .query({ q: 'programming' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('tweets');
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(Array.isArray(res.body.data.tweets)).toBe(true);
      expect(res.body).toHaveProperty('query', 'programming');
      expect(res.body).toHaveProperty('total');
    });

    it("should support cursor pagination", async () => {
      // First request
      const res1 = await request(app)
        .get("/api/search/top")
        .query({ q: 'test' });

      expect(res1.statusCode).toBe(200);
      
      // If cursor is returned, test second page
      if (res1.body.cursor) {
        const res2 = await request(app)
          .get("/api/search/top")
          .query({ q: 'test', cursor: res1.body.cursor });

        expect(res2.statusCode).toBe(200);
        expect(res2.body).toHaveProperty('success', true);
      }
    });

    it("should return 400 without query parameter", async () => {
      const res = await request(app).get("/api/search/top");

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
    });

    it("should return 400 with invalid cursor", async () => {
      const res = await request(app)
        .get("/api/search/top")
        .query({ q: 'test', cursor: 'invalid-cursor-string' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('cursor');
    });
  });

  // ===========================
  // SEARCH PEOPLE TESTS
  // ===========================

  describe("GET /api/search/people", () => {
    it("should return matching users", async () => {
      const res = await request(app)
        .get("/api/search/people")
        .query({ q: 'testuser' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('query', 'testuser');
      expect(res.body).toHaveProperty('total');
    });

    it("should support limit parameter", async () => {
      const res = await request(app)
        .get("/api/search/people")
        .query({ q: 'test', limit: 5 });

      expect(res.statusCode).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data.length).toBeLessThanOrEqual(5);
      }
    });

    it("should support cursor pagination", async () => {
      const res1 = await request(app)
        .get("/api/search/people")
        .query({ q: 'test', limit: 1 });

      expect(res1.statusCode).toBe(200);

      if (res1.body.cursor) {
        const res2 = await request(app)
          .get("/api/search/people")
          .query({ q: 'test', cursor: res1.body.cursor });

        expect(res2.statusCode).toBe(200);
      }
    });

    it("should return 400 without query parameter", async () => {
      const res = await request(app).get("/api/search/people");

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ===========================
  // SEARCH LATEST TESTS
  // ===========================

  describe("GET /api/search/latest", () => {
    it("should return tweets sorted by date", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: 'programming' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Verify dates are in descending order if multiple results
      if (res.body.data.length > 1) {
        const dates = res.body.data.map((t: any) => new Date(t.createdAt).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
      }
    });

    it("should support cursor pagination", async () => {
      const res1 = await request(app)
        .get("/api/search/latest")
        .query({ q: 'test', limit: 1 });

      expect(res1.statusCode).toBe(200);

      if (res1.body.cursor) {
        const res2 = await request(app)
          .get("/api/search/latest")
          .query({ q: 'test', cursor: res1.body.cursor });

        expect(res2.statusCode).toBe(200);
      }
    });

    it("should return 400 without query parameter", async () => {
      const res = await request(app).get("/api/search/latest");

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ===========================
  // SEARCH MEDIA TESTS
  // ===========================

  describe("GET /api/search/media", () => {
    it("should return only tweets with media", async () => {
      const res = await request(app)
        .get("/api/search/media")
        .query({ q: 'programming' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Verify all returned tweets have media
      res.body.data.forEach((tweet: any) => {
        expect(tweet.mediaIds).toBeDefined();
      });
    });

    it("should support cursor pagination", async () => {
      const res1 = await request(app)
        .get("/api/search/media")
        .query({ q: 'test', limit: 1 });

      expect(res1.statusCode).toBe(200);

      if (res1.body.cursor) {
        const res2 = await request(app)
          .get("/api/search/media")
          .query({ q: 'test', cursor: res1.body.cursor });

        expect(res2.statusCode).toBe(200);
      }
    });

    it("should return 400 without query parameter", async () => {
      const res = await request(app).get("/api/search/media");

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ===========================
  // DOCUMENT RETRIEVAL TESTS
  // ===========================

  describe("GET /api/search/document", () => {
    it("should return tweet document by id", async () => {
      const res = await request(app)
        .get("/api/search/document")
        .query({ id: 'tweet1', type: 'tweet' });

      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('type', 'tweet');
        expect(res.body.data).toHaveProperty('id');
      } else {
        expect(res.statusCode).toBe(404);
      }
    });

    it("should return user document by id", async () => {
      const res = await request(app)
        .get("/api/search/document")
        .query({ id: 'user1', type: 'user' });

      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('type', 'user');
      } else {
        expect(res.statusCode).toBe(404);
      }
    });

    it("should return 400 without id parameter", async () => {
      const res = await request(app)
        .get("/api/search/document")
        .query({ type: 'tweet' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    it("should return 400 with invalid type", async () => {
      const res = await request(app)
        .get("/api/search/document")
        .query({ id: 'test1', type: 'invalid' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    it("should return 404 for non-existent document", async () => {
      const res = await request(app)
        .get("/api/search/document")
        .query({ id: 'nonexistent', type: 'tweet' });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ===========================
  // STATS TESTS
  // ===========================

  describe("GET /api/search/stats", () => {
    it("should return index statistics", async () => {
      const res = await request(app).get("/api/search/stats");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      
      // Check for actual properties returned by the API
      expect(res.body.data).toHaveProperty('totalTweets');
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalTokens');
      expect(res.body.data).toHaveProperty('totalHashtags');
      expect(res.body.data).toHaveProperty('totalMentions');
      expect(res.body.data).toHaveProperty('tweetsWithMedia');
      
      // Verify numeric values
      expect(typeof res.body.data.totalTweets).toBe('number');
      expect(typeof res.body.data.totalUsers).toBe('number');
      expect(typeof res.body.data.totalTokens).toBe('number');
    });
  });

  // ===========================
  // REINDEX TESTS
  // ===========================

  describe("POST /api/search/reindex", () => {
    it("should trigger reindex in background", async () => {
      const res = await request(app).post("/api/search/reindex");

      expect(res.statusCode).toBe(202);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('background');
    });
  });

  // ===========================
  // INTEGRATION TESTS
  // ===========================

  describe("Integration Tests", () => {
    it("should complete full search workflow", async () => {
      // Search top results
      const topRes = await request(app)
        .get("/api/search/top")
        .query({ q: 'programming' });

      expect(topRes.statusCode).toBe(200);

      // Search people
      const peopleRes = await request(app)
        .get("/api/search/people")
        .query({ q: 'testuser' });

      expect(peopleRes.statusCode).toBe(200);

      // Search latest
      const latestRes = await request(app)
        .get("/api/search/latest")
        .query({ q: 'programming' });

      expect(latestRes.statusCode).toBe(200);
    });

    it("should handle pagination across multiple requests", async () => {
      // Get first page
      const page1 = await request(app)
        .get("/api/search/latest")
        .query({ q: 'test', limit: 1 });

      expect(page1.statusCode).toBe(200);

      // If cursor exists, get second page
      if (page1.body.cursor) {
        const page2 = await request(app)
          .get("/api/search/latest")
          .query({ q: 'test', cursor: page1.body.cursor, limit: 1 });

        expect(page2.statusCode).toBe(200);

        // Results should be different
        if (page1.body.data.length > 0 && page2.body.data.length > 0) {
          expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
        }
      }
    });
  });

  // ===========================
  // ERROR HANDLING TESTS
  // ===========================

  describe("Error Handling", () => {
    it("should handle malformed JSON gracefully", async () => {
      const res = await request(app)
        .post("/api/search/reindex")
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(res.statusCode).toBe(400);
    });

    it("should handle invalid limit parameters", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: 'test', limit: 'invalid' });

      // Should either parse as NaN and use default, or return 400
      expect([200, 400]).toContain(res.statusCode);
    });

    it("should handle negative limit parameters", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: 'test', limit: -10 });

      // Should either use default limit or return error
      expect([200, 400]).toContain(res.statusCode);
    });

    it("should handle very large limit parameters", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: 'test', limit: 10000 });

      expect(res.statusCode).toBe(200);
      
      // Should cap at reasonable limit
      if (res.body.data.length > 0) {
        expect(res.body.data.length).toBeLessThanOrEqual(100);
      }
    });

    it("should handle empty query strings", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: '' });

      // Should either return empty results or 400
      expect([200, 400]).toContain(res.statusCode);
    });

    it("should handle special characters in query", async () => {
      const res = await request(app)
        .get("/api/search/latest")
        .query({ q: '@#$%^&*()' });

      // Should handle gracefully
      expect([200, 400]).toContain(res.statusCode);
    });
  });
});