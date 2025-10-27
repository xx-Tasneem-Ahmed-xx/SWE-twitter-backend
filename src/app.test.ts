import app from "./app";
import request from "supertest";

describe("Server health", () => {
  it("should return 404 on unknown route", async () => {
    const res = await request(app).get("/notfound");
    expect(res.statusCode).toBe(404);
  });
});
