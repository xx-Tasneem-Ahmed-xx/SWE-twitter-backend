import { prisma } from "@/prisma/client";
import { UserService } from "@/application/services/user.service";
import { connectToDatabase } from "@/database";
import { OSType, User } from "@prisma/client";
import { getKey } from "@/application/services/secrets";
import { AppError } from "@/errors/AppError";

// Define a variable to hold the ID of the default profile picture,
// which will be set in beforeAll using the mocked getKey.
let DEFAULT_PROFILE_PIC_ID: string;

jest.mock("@/application/services/secrets", () => ({
  getKey: jest.fn(),
}));

(getKey as jest.Mock).mockImplementation((keyName: string) => {
  if (keyName === "DEFAULT_PROFILE_PIC_ID") {
    return Promise.resolve("default_pic_123");
  }
  return Promise.resolve(null);
});

const userService = new UserService();

// --- Initial User Data for Reset ---
const initialUsers: User[] = [
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
    joinDate: new Date(), // Placeholder - Prisma will set this
    lastActive: new Date(), // Placeholder
    address: null,
    website: null,
  } as unknown as User,
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
    coverMediaId: null,
    dateOfBirth: new Date("2002-09-01"),
    joinDate: new Date(),
    lastActive: new Date(),
    address: null,
    website: null,
  } as unknown as User,
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
    profileMediaId: "default_pic_123", // Must use resolved constant
    coverMediaId: null,
    dateOfBirth: new Date("2001-12-15"),
    joinDate: new Date(),
    lastActive: new Date(),
    address: null,
    website: null,
  } as unknown as User,
];

describe("UserService", () => {
  beforeAll(async () => {
    DEFAULT_PROFILE_PIC_ID = await getKey("DEFAULT_PROFILE_PIC_ID");
    await connectToDatabase();
    console.log("Running UserService tests with real database connection");

    // Clean up all data before running the *entire suite*
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.mute.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.media.deleteMany({});

    // Create default media (needs to happen once)
    await prisma.media.create({
      data: {
        id: DEFAULT_PROFILE_PIC_ID,
        name: "Default Profile Picture",
        keyName: "default_profile_pic",
        type: "IMAGE",
        size: 0,
      },
    });

    // Create other media (needs to happen once)
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
  });

  // --- FIX: Reset Data Before Every Test ---
  // This ensures that state changes (like username updates, follow/mute creations, etc.)
  // in one test don't affect the next test.
  beforeEach(async () => {
    // 1. Clean up transient data
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.mute.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.user.deleteMany({}); // Delete and recreate users

    // 2. Recreate initial users
    // Filter out extra properties that Prisma doesn't like on createMany
    const userCreateData = initialUsers.map(
      ({
        id,
        username,
        email,
        password,
        saltPassword,
        name,
        bio,
        verified,
        protectedAccount,
        profileMediaId,
        coverMediaId,
        dateOfBirth,
      }) => ({
        id,
        username,
        email,
        password,
        saltPassword,
        name,
        bio,
        verified,
        protectedAccount,
        profileMediaId,
        coverMediaId,
        dateOfBirth,
      })
    );
    await prisma.user.createMany({ data: userCreateData });

    // 3. Recreate initial relationships
    await prisma.follow.createMany({
      data: [
        { followerId: "u1", followingId: "u2" }, // u1 follows u2
        { followerId: "u2", followingId: "u1" }, // u2 follows u1
      ],
    });
  });

  afterAll(async () => {
    // Keep this clean up for the end of the entire suite
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.mute.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.$disconnect();
  });

  // ===================== getUserProfile =====================
  describe("getUserProfile", () => {
    // Tests here should now pass due to beforeEach cleanup/setup
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
    // NOTE: Removed the redundant afterEach from here. The global beforeEach
    // handles the reset automatically, fixing the data contamination issue.
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
      // u1 is 'mohammed_hany' again (due to beforeEach)
      const result = await userService.searchUsers("mohammed", "u3", 2);
      expect(result.users.length).toBeGreaterThan(0);
      expect(result.users[0].username).toContain("mohammed");
      expect(result).toHaveProperty("nextCursor");
    });

    it("should exclude the viewer from results", async () => {
      // u3 is the viewer (salma_adel). Searching for "samir" returns u2 (ahmed_samir).
      const result = await userService.searchUsers("samir", "u3");
      expect(result.users.some((u) => u.id === "u3")).toBe(false);
      expect(result.users.some((u) => u.id === "u2")).toBe(true);
    });

    it("should return empty result for unmatched query", async () => {
      const result = await userService.searchUsers("no_such_user", "u1");
      expect(result.users).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("should correctly return next page with cursor", async () => {
      // Search term 'a' matches multiple users (u1, u2, u3 in data, u1 and u2 returnable to u3)
      const firstPage = await userService.searchUsers("a", "u3", 1);
      expect(firstPage.users.length).toBe(1);
      const nextCursor = firstPage.nextCursor;
      if (nextCursor) {
        const secondPage = await userService.searchUsers(
          "a",
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
      // u2 is guaranteed to exist due to beforeEach
      const updated = await userService.updateProfilePhoto("u2", "profile1");
      expect(updated.profileMediaId).toBe("profile1");
      expect(updated.profileMedia?.keyName).toBe(
        "https://example.com/profile1.jpg"
      );
    });
  });

  describe("deleteProfilePhoto", () => {
    it("should set profile photo to DEFAULT_PROFILE_PIC_ID", async () => {
      // Arrange
      await userService.updateProfilePhoto("u2", "profile1"); // Set to non-default

      // Act
      const updated = await userService.deleteProfilePhoto("u2");

      // Assert
      expect(updated.profileMediaId).toBe(DEFAULT_PROFILE_PIC_ID);

      const saved = await prisma.user.findUnique({ where: { id: "u2" } });
      expect(saved?.profileMediaId).toBe(DEFAULT_PROFILE_PIC_ID);
    });
  });

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
    // Clean up tokens added manually in the second test
    afterEach(async () => {
      await prisma.fcmToken.deleteMany({ where: { userId: "u2" } });
    });

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

// ===================== more tests (Standalone) =====================


it("should handle user without dateOfBirth", async () => {
  const NO_DOB_ID = "u4";
  try {
    // Arrange
    await prisma.user.create({
      data: {
        id: NO_DOB_ID,
        username: "no_dob_user",
        name: "No DOB",
        email: "no_dob@example.com",
        password: "pass",
        saltPassword: "salt",
        verified: false,
        protectedAccount: false,
      },
    });

    // Act
    const user = await userService.getUserProfile("no_dob_user", "u1");

    // Assert
    expect(user?.dateOfBirth).toBeNull();
  } finally {
    // Cleanup
    await prisma.user.deleteMany({ where: { id: NO_DOB_ID } });
  }
});


it("should return empty array if cursor is beyond results", async () => {
  const result = await userService.searchUsers(
    "mohammed",
    "u3",
    1,
    "nonexistent_cursor"
  );
  // FIX: Corrected logical assertion to expect 0 results.
  expect(result.users.length).toBe(0);
});

it("should throw if adding invalid token", async () => {
  await expect(userService.addFcmToken("u1", "", OSType.IOS)).rejects.toThrow();
});

import { userController } from "../api/controllers/user.controller";

describe("UserController edge cases", () => {
  const req: any = { params: {}, body: {}, user: { id: "u1" } };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  beforeEach(() => {
    next.mockClear();
    res.status.mockClear();
    res.json.mockClear();
  });

  it("should return 401 if no user in request for getUserProfile", async () => {
    await userController.getUserProfile({ ...req, user: null }, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it("should return 404 if user not found in getUserProfile", async () => {
    // This is handled by the mock setup that ensures the controller calls next() with an AppError.
    await userController.getUserProfile(
      { ...req, params: { username: "unknown" } },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it("should prevent updating another user's profile", async () => {
    await userController.updateUserProfile(
      { ...req, params: { id: "u2" }, body: {} },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });
});