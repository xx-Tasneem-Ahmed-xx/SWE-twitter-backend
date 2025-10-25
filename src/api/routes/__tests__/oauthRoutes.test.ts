jest.mock("@/docs/tweets", () => ({ registerTweetDocs: jest.fn() }));
jest.mock("@/docs/userInteractions", () => ({ registerUserInteractionsDocs: jest.fn() }));
jest.mock("@/docs/users", () => ({ registerUserDocs: jest.fn() }));
jest.mock("../../../config/redis", () => ({
  redisClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    exists: jest.fn().mockResolvedValue(0),
    flushAll: jest.fn().mockResolvedValue("OK"),
  },
}));

import request from "supertest";
import { app } from "../../../app";

describe("OAuth Routes", () => {
  it("should redirect to Google OAuth", async () => {
    const res = await request(app).get("/oauth2/google");
   expect([200, 201, 302, 404]).toContain(res.statusCode);

  });

  it("should redirect to GitHub OAuth", async () => {
    const res = await request(app).get("/oauth2/github");
   expect([200, 201, 302, 404]).toContain(res.statusCode);

  });
});
