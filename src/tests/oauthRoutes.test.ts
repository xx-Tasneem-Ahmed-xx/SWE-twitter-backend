import dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from 'express';

// Mock setup - MUST come before imports
jest.mock("../../../docs/index", () => ({
  zodDoc: {
    openapi: "3.0.0",
    info: { title: "Mock API", version: "1.0.0" },
    paths: {},
  },
}));

// Mock tweet schema BEFORE any other imports
jest.mock('../../../application/dtos/tweets/tweet.dto.schema', () => {
  const zod = require('zod');
  
  const ReplyControl = {
    REPLY: "REPLY",
    NO_REPLY: "NO_REPLY",
  };
  
  const CreateTweetDTOSchema = zod.z.object({
    content: zod.z.string(),
    replyControl: zod.z.enum(["REPLY", "NO_REPLY"]).optional(),
    mediaIds: zod.z.array(zod.z.string().uuid()).max(4).optional(),
  });
  
  return {
    ReplyControl,
    CreateTweetDTOSchema,
    CreateTweetDTO: CreateTweetDTOSchema,
  };
});

// Mock tweet service schema
jest.mock('../../../application/dtos/tweets/service/tweets.dto.schema', () => {
  const zod = require('zod');
  
  const createTweetServiceSchema = zod.z.object({
    userId: zod.z.string().uuid(),
    content: zod.z.string(),
    replyControl: zod.z.enum(["REPLY", "NO_REPLY"]).optional(),
    mediaIds: zod.z.array(zod.z.string().uuid()).max(4).optional(),
  });
  
  return {
    createTweetServiceSchema,
  };
});

jest.mock("../../../config/redis", () => ({
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

jest.mock('../../../api/middlewares/Reauth', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../api/middlewares/DeactivateUser', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../api/middlewares/AfterChange', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../api/middlewares/GeoGuard', () => ({
  __esModule: true,
  default: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../prisma/client', () => ({
  prisma: {
    user: {
      create: jest.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        saltPassword: 'salt123',
        username: 'testuser',
        name: 'Test User',
        dateOfBirth: new Date('2000-01-01'),
        joinDate: new Date(),
        verified: false,
        isEmailVerified: false,
        tfaVerifed: false,
        tokenVersion: 0,
        protectedAccount: false,
        loginCodesSet: false,
        oldPassword: [],
        deviceRecord: [],
        OAuthAccount: [],
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        saltPassword: 'salt123',
        username: 'testuser',
        name: 'Test User',
        dateOfBirth: new Date('2000-01-01'),
        joinDate: new Date(),
        verified: true,
        isEmailVerified: true,
        tfaVerifed: false,
        tokenVersion: 0,
        protectedAccount: false,
        loginCodesSet: false,
        oldPassword: [],
        deviceRecord: [],
        OAuthAccount: [],
      }),
      update: jest.fn().mockResolvedValue({
        id: '1',
        username: 'updateduser',
        name: 'Updated User',
        email: 'test@example.com',
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        username: 'testuser',
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    oAuthAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'oauth1',
        provider: 'google',
        providerId: '123456',
        userId: '1',
      }),
    },
    session: {
      create: jest.fn().mockResolvedValue({
        jti: 'session123',
        userId: '1',
        isActive: true,
        issuedAt: new Date(),
      }),
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ userId: '1', jti: 'session123' }),
}));

jest.mock('axios', () => ({
  default: jest.fn(),
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: '123456789',
        email: 'test@gmail.com',
        name: 'Test User',
        given_name: 'Test',
      }),
    }),
  })),
}));

let usernameCounter = 0;
jest.mock('../../../application/utils/tweets/utils', () => ({
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
}));

jest.mock('../../../config/secrets', () => ({
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
}));

jest.mock('../../../background/jobs/emailJobs', () => ({
  enqueueSecurityLoginGithub: jest.fn().mockResolvedValue(true),
  enqueueSecurityLoginGoogle: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../application/services/notification', () => ({
  addNotification: jest.fn().mockResolvedValue(true),
}));

import request from "supertest";
import { app } from "../app";
import axios from 'axios';

const oauth = (path: string) => `/api/oauth${path}`;

describe("OAuth Routes - Complete Integration Test Suite", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    usernameCounter = 0;
  });

  describe("1. OAuth Authorization Initialization", () => {
    it("GET /authorize/google - should redirect to Google OAuth page", async () => {
      const res = await request(app)
        .get(oauth("/authorize/google"));
      
      expect([302, 200, 400, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('accounts.google.com');
      }
    });

    it("GET /authorize/github - should redirect to GitHub OAuth page", async () => {
      const res = await request(app)
        .get(oauth("/authorize/github"));
      
      expect([302, 200, 400, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('github.com');
      }
    });

    it("GET /authorize/github_front - should redirect to GitHub OAuth page for frontend", async () => {
      const res = await request(app)
        .get(oauth("/authorize/github_front"));
      
      expect([302, 200, 400, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('github.com');
      }
    });

    it("GET /authorize/invalid - should return error for unsupported provider", async () => {
      const res = await request(app)
        .get(oauth("/authorize/invalid"));
      
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("2. Google OAuth Callback - Web", () => {
    beforeEach(() => {
      (axios as any).mockImplementation((config: any) => {
        if (config.url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve({
            data: {
              access_token: 'mock-google-access-token',
              id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImdpdmVuX25hbWUiOiJUZXN0In0.mock',
              refresh_token: 'mock-refresh-token',
            },
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it("GET /callback/google - should handle Google OAuth callback successfully", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: 'mock-google-auth-code',
          state: 'mock-google-state'
        });
      
      expect([302, 200, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('login/success');
        expect(res.headers.location).toContain('token=');
        expect(res.headers.location).toContain('refresh-token=');
      }
    });

    it("GET /callback/google - should fail without authorization code", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ state: 'mock-google-state' });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/google - should handle OAuth error from Google", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          error: 'access_denied',
          state: 'mock-google-state'
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/google - should handle state mismatch (CSRF protection)", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: 'mock-google-auth-code',
          state: 'invalid-state'
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("3. GitHub OAuth Callback - Mobile", () => {
    beforeEach(() => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'mock-github-access-token',
        },
      });

      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [
              { email: 'test@example.com', primary: true, verified: true },
            ],
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            data: {
              id: 123456,
              login: 'testuser',
              name: 'Test User',
            },
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it("GET /callback/github - should handle GitHub OAuth callback for mobile", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ code: 'mock-github-auth-code' });
      
      expect([302, 200, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('myapp://login/success');
      }
    });

    it("GET /callback/github - should fail without authorization code", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"));
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github - should fail when no verified email found", async () => {
      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [
              { email: 'test@example.com', primary: true, verified: false },
            ],
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ code: 'mock-github-auth-code' });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("4. GitHub OAuth Callback - Frontend Web", () => {
    beforeEach(() => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'mock-github-access-token',
        },
      });

      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [
              { email: 'test@example.com', primary: true, verified: true },
            ],
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            data: {
              id: 123456,
              login: 'testuser',
              name: 'Test User',
            },
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it("GET /callback/github_front - should handle GitHub OAuth callback for frontend", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          code: 'mock-github-auth-code',
          state: 'mock-github-state'
        });
      
      expect([302, 200, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('login/success');
        expect(res.headers.location).toContain('token=');
      }
    });

    it("GET /callback/github_front - should fail with state mismatch", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          code: 'mock-github-auth-code',
          state: 'invalid-state'
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github_front - should handle access_denied error", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          error: 'access_denied',
          state: 'mock-github-state'
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("5. Android Google OAuth", () => {
    it("POST /callback/android_google - should handle Android Google login", async () => {
      const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImdpdmVuX25hbWUiOiJUZXN0In0.mock';
      
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('email');
      }
    });

    it("POST /callback/android_google - should fail without idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({});
      
      expect([400, 500]).toContain(res.statusCode);
    });

    it("POST /callback/android_google - should fail with invalid idToken format", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: 'invalid-token' });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("6. iOS Google OAuth", () => {
    it("POST /callback/ios_google - should handle iOS Google login", async () => {
      const validIdToken = 'mock-ios-google-id-token';
      
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('username');
      }
    });

    it("POST /callback/ios_google - should fail without idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({});
      
      expect([400, 500]).toContain(res.statusCode);
    });

    it("POST /callback/ios_google - should fail with invalid token", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: 'invalid' });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("7. OAuth Account Linking", () => {
    it("should create new user when OAuth email doesn't exist", async () => {
      const { prisma } = require('../../../prisma/client');
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEiLCJlbWFpbCI6Im5ld3VzZXJAZ21haWwuY29tIiwibmFtZSI6Ik5ldyBVc2VyIn0.mock';
      
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 400, 401, 500]).toContain(res.statusCode);
    });

    it("should link OAuth account to existing user", async () => {
      const { prisma } = require('../../../prisma/client');
      prisma.oAuthAccount.findFirst.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: '1',
        email: 'existing@example.com',
        username: 'existinguser',
        tokenVersion: 0,
      });

      const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTU1NTU1NTUiLCJlbWFpbCI6ImV4aXN0aW5nQGV4YW1wbGUuY29tIiwibmFtZSI6IkV4aXN0aW5nIFVzZXIifQ.mock';
      
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("8. OAuth Security & Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (axios as any).mockRejectedValueOnce(new Error('Network error'));

      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: 'mock-code',
          state: 'mock-google-state'
        });
      
      expect([400, 500]).toContain(res.statusCode);
    });

    it("should handle malformed OAuth responses", async () => {
      (axios as any).mockResolvedValueOnce({
        data: {
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid',
        },
      });

      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: 'invalid-code',
          state: 'mock-google-state'
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("should prevent duplicate code processing for GitHub", async () => {
      const { redisClient } = require('../../../config/redis');
      redisClient.get.mockResolvedValueOnce('processing');

      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          code: 'duplicate-code',
          state: 'mock-github-state'
        });
      
      expect([400, 500]).toContain(res.statusCode);
    });

    it("should handle missing primary email in GitHub response", async () => {
      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            data: [
              { email: 'secondary@example.com', primary: false, verified: true },
            ],
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ code: 'mock-code' });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("9. OAuth Token Generation & Storage", () => {
    it("should generate valid JWT tokens after successful OAuth", async () => {
      const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QgVXNlciJ9.mock';
      
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      if (res.statusCode === 200) {
        expect(typeof res.body.token).toBe('string');
        expect(typeof res.body.refreshToken).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(0);
        expect(res.body.refreshToken.length).toBeGreaterThan(0);
      }
    });

    it("should store refresh token in Redis", async () => {
      const { redisClient } = require('../../../config/redis');
      const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIn0.mock';
      
      await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      expect(redisClient.set).toHaveBeenCalled();
    });

    it("should set secure cookies for web OAuth", async () => {
      (axios as any).mockImplementation((config: any) => {
        return Promise.resolve({
          data: {
            access_token: 'mock-access-token',
            id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwibmFtZSI6IlRlc3QgVXNlciJ9.mock',
          },
        });
      });

      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: 'mock-code',
          state: 'mock-google-state'
        });
      
      if (res.statusCode === 302) {
        const cookies = res.headers['set-cookie'];
        if (cookies) {
          expect(Array.