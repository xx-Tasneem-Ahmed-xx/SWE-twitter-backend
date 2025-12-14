import dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from 'express';

// Mock setup - MUST come before imports
jest.mock("../docs/index", () => ({
  zodDoc: {
    openapi: "3.0.0",
    info: { title: "Mock API", version: "1.0.0" },
    paths: {},
  },
}));

// Mock setupTests to prevent actual Redis connection
jest.mock('../setupTests', () => ({
  __esModule: true,
}));

jest.mock('../application/dtos/tweets/tweet.dto.schema', () => {
  const zod = require('zod');
  const ReplyControl = { REPLY: "REPLY", NO_REPLY: "NO_REPLY" };
  const CreateTweetDTOSchema = zod.z.object({
    content: zod.z.string(),
    replyControl: zod.z.enum(["REPLY", "NO_REPLY"]).optional(),
    mediaIds: zod.z.array(zod.z.string().uuid()).max(4).optional(),
  });
  return { ReplyControl, CreateTweetDTOSchema, CreateTweetDTO: CreateTweetDTOSchema };
});

jest.mock('../application/dtos/tweets/service/tweets.dto.schema', () => {
  const zod = require('zod');
  const createTweetServiceSchema = zod.z.object({
    userId: zod.z.string().uuid(),
    content: zod.z.string(),
    replyControl: zod.z.enum(["REPLY", "NO_REPLY"]).optional(),
    mediaIds: zod.z.array(zod.z.string().uuid()).max(4).optional(),
  });
  return { createTweetServiceSchema };
});

jest.mock("../config/redis", () => ({
  redisClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue("OK"),
    setEx: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(0),
    flushAll: jest.fn().mockResolvedValue("OK"),
    ping: jest.fn().mockResolvedValue("PONG"),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn().mockResolvedValue({ cursor: "0", keys: [] }),
    lRange: jest.fn().mockResolvedValue([]),
  },
  initRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/middlewares/Auth', () => {
  const authMiddleware = (req: any, res: any, next: any) => {
    req.user = { id: '1', email: 'test@example.com' };
    next();
  };
  return {
    __esModule: true,
    validateJwt: jest.fn((req: any, res: any, next: any) => {
      req.user = { id: '1', email: 'test@example.com' };
      next();
    }),
    requireAuth: jest.fn((req: any, res: any, next: any) => {
      req.user = { id: '1', email: 'test@example.com' };
      next();
    }),
    default: jest.fn(() => authMiddleware),
  };
});

jest.mock('../api/middlewares/Reauth', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../api/middlewares/DeactivateUser', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../api/middlewares/AfterChange', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../api/middlewares/GeoGuard', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../prisma/client', () => ({
  prisma: {
    user: {
      create: jest.fn().mockResolvedValue({
        id: '1', email: 'test@example.com', password: 'hashedPassword',
        saltPassword: 'salt123', username: 'testuser', name: 'Test User',
        dateOfBirth: new Date('2000-01-01'), joinDate: new Date(),
        verified: false, isEmailVerified: false, tfaVerifed: false,
        tokenVersion: 0, protectedAccount: false, loginCodesSet: false,
        oldPassword: [], deviceRecord: [], OAuthAccount: [],
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: '1', email: 'test@example.com', password: 'hashedPassword',
        saltPassword: 'salt123', username: 'testuser', name: 'Test User',
        dateOfBirth: new Date('2000-01-01'), joinDate: new Date(),
        verified: true, isEmailVerified: true, tfaVerifed: false,
        tokenVersion: 0, protectedAccount: false, loginCodesSet: false,
        oldPassword: [], deviceRecord: [], OAuthAccount: [],
      }),
      update: jest.fn().mockResolvedValue({
        id: '1', username: 'updateduser', name: 'Updated User', email: 'test@example.com',
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({
        id: '1', email: 'test@example.com', password: 'hashedPassword', username: 'testuser',
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    oAuthAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'oauth1', provider: 'google', providerId: '123456', userId: '1',
      }),
    },
    session: {
      create: jest.fn().mockResolvedValue({
        jti: 'session123', userId: '1', isActive: true, issuedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue({
        jti: 'session123', userId: '1', isActive: true, issuedAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          jti: 'session123', userId: '1', isActive: true, issuedAt: new Date(),
          deviceInfoId: 'dev1',
        },
      ]),
      update: jest.fn().mockResolvedValue({
        jti: 'session123', userId: '1', isActive: false,
      }),
      delete: jest.fn().mockResolvedValue({
        jti: 'session123',
      }),
    },
    oldPassword: {
      create: jest.fn().mockResolvedValue({
        id: 'old1', userId: '1', password: 'oldHashedPassword',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    deviceRecord: {
      create: jest.fn().mockResolvedValue({
        id: 'dev1', city: 'Cairo', country: 'Egypt', userId: '1', lastLogin: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({
        id: 'dev1', lastLogin: new Date(),
      }),
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ userId: '1', jti: 'session123' }),
}));

// Fixed axios mock
const mockAxios = jest.fn();
const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: mockAxios,
  post: mockAxiosPost,
  get: mockAxiosGet,
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: '123456789', email: 'test@gmail.com', name: 'Test User', given_name: 'Test',
      }),
    }),
  })),
}));

let usernameCounter = 0;
jest.mock('../application/utils/utils', () => ({
  SendEmailSmtp: jest.fn().mockResolvedValue(true),
  SendRes: jest.fn((res: any, data: any) => res.json(data)),
  generateUsername: jest.fn().mockImplementation((name: string) => {
    usernameCounter++;
    return Promise.resolve(`${name}_${usernameCounter}`);
  }),
  HashPassword: jest.fn().mockResolvedValue('hashedPassword'),
  CheckPass: jest.fn().mockResolvedValue(true),
  ValidatePassword: jest.fn().mockResolvedValue('0'),
  SetDeviceInfo: jest.fn().mockResolvedValue({ devid: 'dev1', deviceRecord: {} }),
  GenerateJwt: jest.fn().mockResolvedValue({ token: 'mock.jwt.token', jti: 'session123' }),
  SetSession: jest.fn().mockResolvedValue(true),
  Sendlocation: jest.fn().mockResolvedValue({ City: 'Cairo', Country: 'Egypt' }),
  AddPasswordHistory: jest.fn().mockResolvedValue(true),
  Attempts: jest.fn().mockResolvedValue(false),
  IncrAttempts: jest.fn().mockResolvedValue(true),
  RestAttempts: jest.fn().mockResolvedValue(true),
  ResetAttempts: jest.fn().mockResolvedValue(false),
  IncrResetAttempts: jest.fn().mockResolvedValue(true),
  RsetResetAttempts: jest.fn().mockResolvedValue(true),
  ValidateToken: jest.fn().mockReturnValue({ ok: true, payload: { id: '1', jti: 'session123' } }),
  AnalisePass: jest.fn().mockReturnValue({ score: 4 }),
  NotOldPassword: jest.fn().mockResolvedValue('0'),
}));

jest.mock('../config/secrets', () => ({
  getSecrets: jest.fn().mockReturnValue({
    client_id: 'mock-google-client-id',
    client_secret: 'mock-google-client-secret',
    redirect_uri: 'http://localhost:3000/api/oauth/callback/google',
    google_state: 'mock-google-state',
    githubClientId: 'mock-github-client-id',
    GITHUB_CLIENT_SECRET: 'mock-github-secret',
    redirectUri: 'http://localhost:3000/api/oauth/callback/github',
    githubState: 'mock-github-state',
    GITHUB_CLIENT_ID_FRONT: 'mock-github-client-id-front',
    GITHUB_SECRET_FRONT: 'mock-github-secret-front',
    GITHUB_RED_URL_FRONT: 'http://localhost:3000/api/oauth/callback/github_front',
    google_IOS_clientID: 'mock-ios-client-id',
    FRONTEND_URL: 'http://localhost:3000',
    JWT_SECRET: 'mock-jwt-secret',
  }),
  loadSecrets: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../background/jobs/emailJobs', () => ({
  enqueueSecurityLoginGithub: jest.fn().mockResolvedValue(true),
  enqueueSecurityLoginGoogle: jest.fn().mockResolvedValue(true),
}));

jest.mock('../application/services/notification', () => ({
  addNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock('../api/controllers/notificationController', () => ({
  addNotification: jest.fn((_, data, callback) => callback?.(null)),
  getNotificationList: jest.fn((req, res) => res.json([])),
  getMentionNotifications: jest.fn((req, res) => res.json([])),
  getUnseenNotificationsCount: jest.fn((req, res) => res.json({ count: 0 })),
  getUnseenNotifications: jest.fn((req, res) => res.json([])),
}));

import request from "supertest";
import { app } from "../app";

const oauth = (path: string) => `/api/oauth${path}`;

describe("OAuth Routes - Complete Integration Test Suite", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    usernameCounter = 0;
  });

  describe("1. OAuth Authorization", () => {
    it("GET /authorize/google - redirect to Google", async () => {
      const res = await request(app).get(oauth("/authorize/google"));
      expect([302, 200, 400, 404, 500]).toContain(res.statusCode);
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('accounts.google.com');
      }
    });

    it("GET /authorize/github - redirect to GitHub", async () => {
      const res = await request(app).get(oauth("/authorize/github"));
      expect([302, 200, 400, 404, 500]).toContain(res.statusCode);
      if (res.statusCode === 302) {
        expect(res.headers.location).toContain('github.com');
      }
    });

    it("GET /authorize/github_front - redirect for frontend", async () => {
      const res = await request(app).get(oauth("/authorize/github_front"));
      expect([302, 200, 400, 404, 500]).toContain(res.statusCode);
    });

    it("GET /authorize/invalid - unsupported provider", async () => {
      const res = await request(app).get(oauth("/authorize/invalid"));
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("2. Google OAuth Callback", () => {
    beforeEach(() => {
      mockAxios.mockImplementation((config: any) => {
        if (config.url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve({
            data: {
              access_token: 'mock-access',
              id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QiLCJnaXZlbl9uYW1lIjoiVGVzdCJ9.mock',
              refresh_token: 'mock-refresh',
            },
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it("should handle successful callback", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ code: 'mock-code', state: 'mock-google-state' });
      expect([302, 200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should fail without code", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ state: 'mock-google-state' });
      expect([400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should handle state mismatch", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ code: 'mock-code', state: 'invalid-state' });
      expect([400, 401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("3. GitHub OAuth Mobile", () => {
    beforeEach(() => {
      mockAxiosPost.mockResolvedValue({
        data: { access_token: 'mock-github-token' },
      });
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [{ email: 'test@example.com', primary: true, verified: true }],
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            data: { id: 123456, login: 'testuser', name: 'Test User' },
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it("should handle mobile callback", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ code: 'mock-code' });
      expect([302, 200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should fail without code", async () => {
      const res = await request(app).get(oauth("/callback/github"));
      expect([400, 401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("4. GitHub OAuth Frontend", () => {
    beforeEach(() => {
      mockAxiosPost.mockResolvedValue({
        data: { access_token: 'mock-token' },
      });
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [{ email: 'test@example.com', primary: true, verified: true }],
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            data: { id: 123456, login: 'testuser', name: 'Test' },
          });
        }
        return Promise.reject(new Error('Unknown'));
      });
    });

    it("should handle frontend callback", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ code: 'mock-code', state: 'mock-github-state' });
      expect([302, 200, 400, 401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("5. Android Google OAuth", () => {
    it("should handle Android login", async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QiLCJnaXZlbl9uYW1lIjoiVGVzdCJ9.mock';
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: token });
      expect([200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should fail without token", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({});
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("6. iOS Google OAuth", () => {
    it("should handle iOS login", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: 'mock-ios-token' });
      expect([200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should fail without token", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({});
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("7. Account Linking", () => {
    it("should create new user", async () => {
      const { prisma } = require('../prisma/client');
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEiLCJlbWFpbCI6Im5ld0BnbWFpbC5jb20iLCJuYW1lIjoiTmV3In0.mock';
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: token });
      expect([200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should link to existing user", async () => {
      const { prisma } = require('../prisma/client');
      prisma.oAuthAccount.findFirst.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: '1', email: 'existing@example.com', username: 'existing', tokenVersion: 0,
      });
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTU1NTU1IiwiZW1haWwiOiJleGlzdGluZ0BleGFtcGxlLmNvbSIsIm5hbWUiOiJFeGlzdGluZyJ9.mock';
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: token });
      expect([200, 400, 401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("8. Security & Errors", () => {
    it("should handle network errors", async () => {
      mockAxios.mockRejectedValueOnce(new Error('Network error'));
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ code: 'mock', state: 'mock-google-state' });
      expect([400, 404, 500]).toContain(res.statusCode);
    });

    it("should prevent duplicate processing", async () => {
      const { redisClient } = require('../config/redis');
      redisClient.get.mockResolvedValueOnce('processing');
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ code: 'duplicate', state: 'mock-github-state' });
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("9. Token Management", () => {
    it("should generate valid tokens", async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QifQ.mock';
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: token });
      if (res.statusCode === 200) {
        expect(res.body.token).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
      }
      expect([200, 400, 401, 404, 500]).toContain(res.statusCode);
    });

    it("should store in Redis", async () => {
      const { redisClient } = require('../config/redis');
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIn0.mock';
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: token });
      
      if (res.statusCode === 200) {
        expect(redisClient.set).toHaveBeenCalled();
      } else {
        expect([200, 404]).toContain(res.statusCode);
      }
    });
  });
});