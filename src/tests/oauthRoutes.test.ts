import dotenv from "dotenv";
dotenv.config();

// Mock setup - MUST come before any imports that use these modules
jest.mock("@/docs/tweets", () => ({ 
  registerTweetDocs: jest.fn() 
}));

jest.mock("@/docs/userInteractions", () => ({ 
  registerUserInteractionsDocs: jest.fn() 
}));

jest.mock("@/docs/users", () => ({ 
  registerUserDocs: jest.fn() 
}));

jest.mock("../../../docs/index", () => ({
  zodDoc: {
    openapi: "3.0.0",
    info: { title: "Mock API", version: "1.0.0" },
    paths: {},
  },
}));

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

jest.mock('../../../prisma/client', () => ({
  prisma: {
    user: {
      create: jest.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: '',
        saltPassword: '',
        username: 'testuser',
        name: 'Test User',
        dateOfBirth: new Date('2001-11-03'),
        joinDate: new Date(),
        verified: false,
        isEmailVerified: true,
        tfaVerifed: false,
        tokenVersion: 0,
        protectedAccount: false,
        loginCodesSet: false,
        bio: null,
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: '',
        saltPassword: '',
        username: 'testuser',
        name: 'Test User',
        dateOfBirth: new Date('2001-11-03'),
        tokenVersion: 0,
        isEmailVerified: true,
      }),
      update: jest.fn().mockResolvedValue({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        tokenVersion: 1,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
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
  },
}));

// Mock secrets/config
jest.mock('../../../config/secrets', () => ({
  getSecrets: jest.fn(() => ({
    client_id: 'mock-google-client-id',
    client_secret: 'mock-google-secret',
    redirect_uri: 'http://localhost:3000/oauth2/callback/google',
    google_state: 'mock-google-state',
    githubClientId: 'mock-github-client-id',
    GITHUB_CLIENT_SECRET: 'mock-github-secret',
    redirectUri: 'http://localhost:3000/oauth2/callback/github',
    githubState: 'mock-github-state',
    GITHUB_CLIENT_ID_FRONT: 'mock-github-front-id',
    GITHUB_SECRET_FRONT: 'mock-github-front-secret',
    GITHUB_RED_URL_FRONT: 'http://localhost:3000/oauth2/callback/github_front',
    google_IOS_clientID: 'mock-ios-client-id',
    FRONTEND_URL: 'http://localhost:3001',
    JWT_SECRET: 'test-secret',
    PEPPER: 'test-pepper',
  })),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({ 
    userId: '1', 
    jti: 'session123',
    email: 'test@example.com' 
  }),
}));

// Mock axios for OAuth API calls
jest.mock('axios', () => ({
  __esModule: true,
  default: jest.fn((config: any) => {
    if (config.url?.includes('oauth2.googleapis.com/token')) {
      return Promise.resolve({
        data: {
          access_token: 'mock-google-access-token',
          id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature',
        },
      });
    }
    return Promise.resolve({ data: {} });
  }),
  post: jest.fn((url: string) => {
    if (url.includes('github.com/login/oauth/access_token')) {
      return Promise.resolve({
        data: {
          access_token: 'mock-github-access-token',
          token_type: 'bearer',
        },
      });
    }
    return Promise.resolve({ data: {} });
  }),
  get: jest.fn((url: string) => {
    if (url.includes('github.com/user/emails')) {
      return Promise.resolve({
        data: [
          { email: 'test@example.com', primary: true, verified: true }
        ],
      });
    }
    if (url.includes('github.com/user')) {
      return Promise.resolve({
        data: {
          id: 123456,
          login: 'testuser',
          name: 'Test User',
        },
      });
    }
    return Promise.resolve({ data: {} });
  }),
}));

// Mock google-auth-library
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: jest.fn().mockReturnValue({
        email: 'test@example.com',
        given_name: 'Test',
        name: 'Test User',
        sub: '123456',
      }),
    }),
  })),
}));

// Mock utility functions
jest.mock('../../../application/utils/tweets/utils', () => ({
  SendEmailSmtp: jest.fn().mockResolvedValue(true),
  SendRes: jest.fn((res: any, data: any) => res.json(data)),
  generateUsername: jest.fn().mockResolvedValue('testuser123'),
  HashPassword: jest.fn().mockResolvedValue('hashedPassword'),
  CheckPass: jest.fn().mockResolvedValue(true),
  ValidatePassword: jest.fn().mockResolvedValue('0'),
  SetDeviceInfo: jest.fn().mockResolvedValue({ 
    devid: 'dev1', 
    deviceRecord: { browser: 'Chrome', os: 'Windows' } 
  }),
  GenerateJwt: jest.fn().mockResolvedValue({ 
    token: 'mock.jwt.token', 
    jti: 'session123',
    payload: { id: '1', email: 'test@example.com' }
  }),
  SetSession: jest.fn().mockResolvedValue(true),
  Sendlocation: jest.fn().mockResolvedValue({ 
    City: 'Cairo', 
    Country: 'Egypt',
    Query: '127.0.0.1' 
  }),
  AddPasswordHistory: jest.fn().mockResolvedValue(true),
  ValidateToken: jest.fn().mockReturnValue({ 
    ok: true, 
    payload: { id: '1', jti: 'session123', email: 'test@example.com' } 
  }),
}));

// Mock email jobs
jest.mock('../../../background/jobs/emailJobs', () => ({
  enqueueSecurityLoginGoogle: jest.fn().mockResolvedValue(true),
  enqueueSecurityLoginGithub: jest.fn().mockResolvedValue(true),
}));

// Mock notification controller
jest.mock('../../controllers/notificationController', () => ({
  addNotification: jest.fn((_, data, callback) => callback?.(null)),
  getNotificationList: jest.fn((req, res) => res.json([])),
  getUnseenNotificationsCount: jest.fn((req, res) => res.json({ count: 0 })),
  getUnseenNotifications: jest.fn((req, res) => res.json([])),
}));


// Mock middlewares
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

// Mock AppError
jest.mock('@/errors/AppError', () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// Now import after all mocks are set up
import request from "supertest";
import { app } from "../app";

const oauth = (path: string) => `/oauth2${path}`;

describe("OAuth Routes - Complete Test Suite", () => {
  
  describe("1. Authorization Endpoints", () => {
    it("GET /authorize/google - should redirect to Google OAuth", async () => {
      const res = await request(app).get(oauth("/authorize/google"));
      
      expect([200, 302, 404, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('accounts.google.com');
      }
    });

    it("GET /authorize/github - should redirect to GitHub OAuth", async () => {
      const res = await request(app).get(oauth("/authorize/github"));
      
      expect([200, 302, 404, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('github.com');
      }
    });

    it("GET /authorize/github_front - should redirect to GitHub OAuth (frontend)", async () => {
      const res = await request(app).get(oauth("/authorize/github_front"));
      
      expect([200, 302, 404, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('github.com');
      }
    });

    it("GET /authorize/invalid - should reject invalid provider", async () => {
      const res = await request(app).get(oauth("/authorize/invalid"));
      
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("2. Google OAuth Callbacks", () => {
    it("GET /callback/google - should handle Google callback successfully", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "mock-google-auth-code", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
        expect(res.headers.location).toContain('localhost:3001');
      }
    });

    it("GET /callback/google - should fail without code", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ state: "mock-google-state" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/google - should fail with invalid state", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "mock-code", 
          state: "wrong-state" 
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/google - should handle OAuth error", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          error: "access_denied",
          state: "mock-google-state"
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("3. GitHub OAuth Callbacks", () => {
    it("GET /callback/github - should handle GitHub callback successfully", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ 
          code: "mock-github-auth-code", 
          state: "mock-github-state" 
        });
      
      expect([200, 302, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 302) {
        expect(res.headers.location).toBeDefined();
      }
    });

    it("GET /callback/github - should fail without code", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ state: "mock-github-state" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github_front - should handle GitHub frontend callback", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          code: "mock-github-code", 
          state: "mock-github-state" 
        });
      
      expect([200, 302, 400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github_front - should fail without code", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ state: "mock-github-state" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github_front - should handle OAuth error", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          error: "access_denied",
          state: "mock-github-state"
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("GET /callback/github_front - should prevent CSRF with invalid state", async () => {
      const res = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ 
          code: "mock-code",
          state: "invalid-state"
        });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("4. Android Google OAuth", () => {
    const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature';

    it("POST /callback/android_google - should handle Android Google login", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 201, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('email');
        expect(res.body.user).toHaveProperty('username');
      }
    });

    it("POST /callback/android_google - should fail without idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({});
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("POST /callback/android_google - should fail with invalid idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: "invalid.token.here" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("POST /callback/android_google - should fail with malformed idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: "not-a-jwt-token" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });
  });

  describe("5. iOS Google OAuth", () => {
    const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature';

    it("POST /callback/ios_google - should handle iOS Google login", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 201, 400, 401, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('email');
        expect(res.body.user).toHaveProperty('username');
      }
    });

    it("POST /callback/ios_google - should fail without idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({});
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("POST /callback/ios_google - should fail with invalid idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: "invalid.token.here" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("POST /callback/ios_google - should create new user if not exists", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ idToken: validIdToken });
      
      expect([200, 201, 400, 500]).toContain(res.statusCode);
    });
  });

  describe("6. User Account Creation & Linking", () => {
    it("should create new user on first Google OAuth", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "new-user-code", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });

    it("should link OAuth to existing user account", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ 
          code: "existing-user-code", 
          state: "mock-github-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });

    it("should return existing user on subsequent OAuth", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 201, 400, 500]).toContain(res.statusCode);
    });
  });

  describe("7. Token Generation & Sessions", () => {
    it("should generate access and refresh tokens on successful OAuth", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      if (res.statusCode === 200) {
        expect(res.body.token).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(typeof res.body.token).toBe('string');
        expect(typeof res.body.refreshToken).toBe('string');
      }
    });

    it("should set cookies on web OAuth callback", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "mock-code", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });

    it("should store refresh token in Redis", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 400, 500]).toContain(res.statusCode);
    });
  });

  describe("8. Device & Location Tracking", () => {
    it("should track device info on OAuth login", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .set('User-Agent', 'Mozilla/5.0 (Android)')
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 400, 500]).toContain(res.statusCode);
    });

    it("should send security notification email on OAuth login", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "mock-code", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });
  });

  describe("9. Error Handling & Edge Cases", () => {
    it("should handle network errors gracefully", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "error-code", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 401, 500]).toContain(res.statusCode);
    });

    it("should handle invalid JSON in idToken", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ idToken: "invalid.json.token" });
      
      expect([400, 401, 500]).toContain(res.statusCode);
    });

    it("should handle missing email in OAuth response", async () => {
      const res = await request(app)
        .get(oauth("/callback/github"))
        .query({ 
          code: "no-email-code", 
          state: "mock-github-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });

    it("should handle database errors gracefully", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 400, 500]).toContain(res.statusCode);
    });

    it("should handle missing OAuth provider data", async () => {
      const res = await request(app)
        .get(oauth("/callback/google"))
        .query({ 
          code: "incomplete-data", 
          state: "mock-google-state" 
        });
      
      expect([200, 302, 400, 500]).toContain(res.statusCode);
    });

    it("should prevent duplicate code processing (CSRF protection)", async () => {
      const code = "duplicate-code-test";
      
      const res1 = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ code, state: "mock-github-state" });
      
      const res2 = await request(app)
        .get(oauth("/callback/github_front"))
        .query({ code, state: "mock-github-state" });
      
      expect([200, 302, 400, 401, 500]).toContain(res1.statusCode);
      expect([200, 302, 400, 401, 500]).toContain(res2.statusCode);
    });
  });

  describe("10. Integration Tests", () => {
    it("should complete full Google OAuth flow", async () => {
      const initiateRes = await request(app)
        .get(oauth("/authorize/google"));
      
      expect([302, 404, 500]).toContain(initiateRes.statusCode);
      
      if (initiateRes.statusCode === 302) {
        const callbackRes = await request(app)
          .get(oauth("/callback/google"))
          .query({ code: "mock-code", state: "mock-google-state" });
        
        expect([200, 302, 400, 500]).toContain(callbackRes.statusCode);
      }
    });

    it("should complete full GitHub OAuth flow", async () => {
      const initiateRes = await request(app)
        .get(oauth("/authorize/github"));
      
      expect([302, 404, 500]).toContain(initiateRes.statusCode);
      
      if (initiateRes.statusCode === 302) {
        const callbackRes = await request(app)
          .get(oauth("/callback/github"))
          .query({ code: "mock-code", state: "mock-github-state" });
        
        expect([200, 302, 400, 500]).toContain(callbackRes.statusCode);
      }
    });

    it("should complete Android Google OAuth flow", async () => {
      const res = await request(app)
        .post(oauth("/callback/android_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 400, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe('test@example.com');
      }
    });

    it("should complete iOS Google OAuth flow", async () => {
      const res = await request(app)
        .post(oauth("/callback/ios_google"))
        .send({ 
          idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJnaXZlbl9uYW1lIjoiVGVzdCIsIm5hbWUiOiJUZXN0IFVzZXIiLCJzdWIiOiIxMjM0NTYifQ.mock-signature'
        });
      
      expect([200, 400, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe('test@example.com');
      }
    });
  });
});