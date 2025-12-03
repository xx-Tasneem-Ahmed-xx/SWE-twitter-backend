import { prisma } from "@/prisma/client";
import { UserService } from "@/application/services/user.service";
import { connectToDatabase } from "@/database";
import { OSType } from "@prisma/client";

const userService = new UserService();

describe("UserService", () => {
  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running UserService tests with real database connection");

    // Clean up any old data
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.media.deleteMany({});

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

    // create users
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
        {
          id: "u3",
          username: "salma_adel",
          email: "salma@example.com",
          password: "hashedpass3",
          saltPassword: "salt3",
          name: "Salma Adel",
          bio: "Frontend Developer",
          verified: true,
          protectedAccount: false,
          dateOfBirth: new Date("2001-12-15"), // ← added this field
        },
      ],
    });

    // create follow relationships
    await prisma.follow.createMany({
      data: [
        { followerId: "u1", followingId: "u2" }, // u1 follows u2
        { followerId: "u2", followingId: "u1" }, // u2 follows u1
      ],
    });
  });

  afterAll(async () => {
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.$disconnect();
  });

  // ===================== getUserProfile =====================
  describe("getUserProfile", () => {
    it("should return correct user profile with follower/following context", async () => {
      const user = await userService.getUserProfile("mohammed_hany", "u2");

      expect(user).not.toBeNull();
      expect(user?.id).toBe("u1");
      expect(user?.name).toBe("Mohammed Hany");
      expect(user?.isFollower).toBe(true); // u2 follows u1
      expect(user?.isFollowing).toBe(true); // u1 follows u2
      expect(typeof user?.joinDate).toBe("string");
      expect(typeof user?.dateOfBirth).toBe("string");
    });

    it("should return null if username not found", async () => {
      const user = await userService.getUserProfile("unknown_user", "u1");
      expect(user).toBeNull();
    });
  });

  // ===================== updateUserProfile =====================
  describe("updateUserProfile", () => {
    it("should update user’s general info correctly", async () => {
      const data = {
        name: "Mohammed Updated",
        username: "mohammed_updated",
        bio: "Updated bio",
        address: "Cairo, Egypt",
        website: "https://mohammed.dev",
        protectedAccount: true,
      };

      const updated = await userService.updateUserProfile("u1", data);
      expect(updated.name).toBe("Mohammed Updated");
      expect(updated.username).toBe("mohammed_updated");
      expect(updated.protectedAccount).toBe(true);
      expect(typeof updated.joinDate).toBe("string");

      const saved = await prisma.user.findUnique({ where: { id: "u1" } });
      expect(saved?.username).toBe("mohammed_updated");
    });

    it("should throw if user does not exist", async () => {
      await expect(
        userService.updateUserProfile("invalid_id", {
          name: "Fake",
          username: "fake",
          bio: "None",
          address: "",
          website: "",
          protectedAccount: false,
        })
      ).rejects.toThrow();
    });
  });

  // ===================== searchUsers =====================
  describe("searchUsers", () => {
    it("should return paginated users matching query", async () => {
      const result = await userService.searchUsers("mohammed", "u3", 2);
      expect(result.users.length).toBeGreaterThan(0);
      expect(result.users[0].username).toContain("mohammed");
      expect(result).toHaveProperty("nextCursor");
    });

    it("should exclude the viewer from results", async () => {
      const result = await userService.searchUsers("sara", "u3");
      expect(result.users.some((u) => u.id === "u3")).toBe(false);
    });

    it("should return empty result for unmatched query", async () => {
      const result = await userService.searchUsers("no_such_user", "u1");
      expect(result.users).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("should correctly return next page with cursor", async () => {
      const firstPage = await userService.searchUsers("mohammed", "u3", 1);
      expect(firstPage.users.length).toBe(1);
      const nextCursor = firstPage.nextCursor;
      if (nextCursor) {
        const secondPage = await userService.searchUsers(
          "mohammed",
          "u3",
          1,
          nextCursor
        );
        expect(secondPage.users.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ===================== updateProfilePhoto / deleteProfilePhoto =====================
  describe("updateProfilePhoto", () => {
    it("should update user’s profile photo", async () => {
      const updated = await userService.updateProfilePhoto("u2", "profile1");
      expect(updated.profileMediaId).toBe("profile1");
      expect(updated.profileMedia?.keyName).toBe(
        "https://example.com/profile1.jpg"
      );
    });
  });

  //TODO: update this test after implementing deleteProfilePhoto
  // describe("deleteProfilePhoto", () => {
  //   it("should remove profile photo (set to null)", async () => {
  //     await userService.updateProfilePhoto("u2", "profile2");
  //     const updated = await userService.deleteProfilePhoto("u2");
  //     expect(updated.profileMediaId).toBeNull();
  //     const saved = await prisma.user.findUnique({ where: { id: "u2" } });
  //     expect(saved?.profileMediaId).toBeNull();
  //   });
  // });

  // ===================== updateProfileBanner / deleteProfileBanner =====================
  describe("updateProfileBanner", () => {
    it("should update user’s profile banner", async () => {
      const updated = await userService.updateProfileBanner("u1", "cover1");
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

  // ===================== addFcmToken =====================
  describe("addFcmToken", () => {
    it("should insert a new FCM token", async () => {
      const token = "fcm_token_123";
      const osType = OSType.ANDROID;

      const result = await userService.addFcmToken("u1", token, osType);
      expect(result.token).toBe(token);
      expect(result.osType).toBe(osType);
      expect(result.userId).toBe("u1");
    });

    it("should update existing token if already stored", async () => {
      const token = "existing_token";
      const osType = OSType.IOS;

      await prisma.fcmToken.create({
        data: { token, userId: "u2", osType },
      });

      const result = await userService.addFcmToken("u2", token, osType);
      expect(result.token).toBe(token);
      expect(result.userId).toBe("u2");

      const count = await prisma.fcmToken.count({ where: { token } });
      expect(count).toBe(1);
    });
  });
});
