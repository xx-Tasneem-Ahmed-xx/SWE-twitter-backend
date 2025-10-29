import { prisma } from "@/prisma/client";
import { UserService } from "@/application/services/user.service";
import { connectToDatabase } from "@/database";

const userService = new UserService();

describe("UserService", () => {
  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running UserService tests with real database connection");

    // create media
    await prisma.media.createMany({
      data: [
        {
          id: "profile1",
          name: "profile1.jpg",
          keyName: "https://example.com/profile1.jpg",
          type: "IMAGE",
        },
        {
          id: "cover1",
          name: "cover1.jpg",
          keyName: "https://example.com/cover1.jpg",
          type: "IMAGE",
        },
        {
          id: "profile2",
          name: "profile2.jpg",
          keyName: "https://example.com/profile2.jpg",
          type: "IMAGE",
        },
      ],
    });

    // create sample users
    await prisma.user.createMany({
      data: [
        {
          id: "u1",
          username: "mohammed_hany",
          email: "mohammed@example.com",
          password: "hashedpass",
          saltPassword: "salt",
          name: "Mohammed Hany",
          bio: "Engineer and AI Enthusiast",
          verified: true,
          protectedAccount: false,
          profileMediaId: "profile1",
          coverMediaId: "cover1",
          dateOfBirth: new Date("2003-10-01"),
        },
        {
          id: "u2",
          username: "ahmed_samir",
          email: "ahmed@example.com",
          password: "hashedpass2",
          saltPassword: "salt2",
          name: "Ahmed Samir",
          bio: "Tech lover",
          verified: false,
          protectedAccount: false,
          profileMediaId: "profile2",
          dateOfBirth: new Date("2002-09-01"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: ["u1", "u2"] } },
    });
    await prisma.media.deleteMany({
      where: { id: { in: ["profile1", "profile2", "cover1"] } },
    });
    await prisma.$disconnect();
  });

  describe("getUserProfile", () => {
    it("should return user profile by username", async () => {
      const user = await userService.getUserProfile("mohammed_hany");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("u1");
      expect(user?.name).toBe("Mohammed Hany");
      expect(user?.profileMedia).toHaveProperty("keyName");
      expect(user?.coverMedia).toHaveProperty("keyName");
    });

    it("should return null if user not found", async () => {
      const user = await userService.getUserProfile("unknown_user");
      expect(user).toBeNull();
    });
  });

  describe("updateUserProfile", () => {
    it("should update a user’s general information", async () => {
      const data = {
        name: "Mohammed Updated",
        username: "mohammed_updated",
        bio: "Updated bio",
        address: "Cairo, Egypt",
        website: "https://mohammedhany.dev",
        protectedAccount: true,
      };

      const updated = await userService.updateUserProfile("u1", data);
      expect(updated.name).toBe("Mohammed Updated");
      expect(updated.username).toBe("mohammed_updated");
      expect(updated.bio).toBe("Updated bio");
      expect(updated.protectedAccount).toBe(true);

      const saved = await prisma.user.findUnique({ where: { id: "u1" } });
      expect(saved?.username).toBe("mohammed_updated");
    });

    it("should throw error if user does not exist", async () => {
      await expect(
        userService.updateUserProfile("not_exist", {
          name: "Fake User",
          username: "fake",
          bio: "None",
          address: "NA",
          website: "",
          protectedAccount: false,
        })
      ).rejects.toThrow();
    });
  });

  describe("searchUsers", () => {
    it("should return users whose name or username contains query", async () => {
      const users = await userService.searchUsers("mohammed");
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].username).toContain("mohammed");
    });

    it("should return empty array for unmatched query", async () => {
      const users = await userService.searchUsers("xyz_nonexistent");
      expect(users).toEqual([]);
    });
  });

  describe("updateProfilePhoto", () => {
    it("should update user’s profile photo", async () => {
      const updatedUser = await userService.updateProfilePhoto(
        "u2",
        "profile1"
      );
      expect(updatedUser.profileMediaId).toBe("profile1");
      expect(updatedUser.profileMedia?.keyName).toBe(
        "https://example.com/profile1.jpg"
      );

      const saved = await prisma.user.findUnique({ where: { id: "u2" } });
      expect(saved?.profileMediaId).toBe("profile1");
    });
  });

  describe("deleteProfilePhoto", () => {
    it("should remove profile photo (set to null)", async () => {
      await userService.updateProfilePhoto("u1", "profile2");
      const updated = await userService.deleteProfilePhoto("u1");
      expect(updated.profileMediaId).toBeNull();

      const saved = await prisma.user.findUnique({ where: { id: "u1" } });
      expect(saved?.profileMediaId).toBeNull();
    });
  });

  describe("updateProfileBanner", () => {
    it("should update user’s profile banner", async () => {
      const updated = await userService.updateProfileBanner("u2", "cover1");
      expect(updated.coverMediaId).toBe("cover1");
      expect(updated.coverMedia?.keyName).toBe(
        "https://example.com/cover1.jpg"
      );
    });
  });

  describe("deleteProfileBanner", () => {
    it("should remove profile banner (set to null)", async () => {
      await userService.updateProfileBanner("u1", "cover1");
      const updated = await userService.deleteProfileBanner("u1");
      expect(updated.coverMediaId).toBeNull();

      const saved = await prisma.user.findUnique({ where: { id: "u1" } });
      expect(saved?.coverMediaId).toBeNull();
    });
  });
});
