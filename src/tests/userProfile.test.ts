/**
 * src/tests/userProfile.test.ts
 *
 * Full updated test suite (Option A - preserve existing tests, fix lifecycle + mocks)
 */

import { prisma } from "@/prisma/client";
import { UserService } from "@/application/services/user.service";
import { connectToDatabase } from "@/database";
import { OSType, User } from "@prisma/client";
import { getKey } from "@/application/services/secrets";
import { AppError } from "@/errors/AppError";
import { userController } from "@/api/controllers/user.controller";
jest.mock("@/application/services/secrets", () => ({
  getKey: jest.fn(),
}));

// Provide a stable default id returned by getKey in tests
(getKey as jest.Mock).mockImplementation(async (keyName: string) => {
  if (keyName === "DEFAULT_PROFILE_PIC_ID") {
    return "default_pic_123";
  }
  return null;
});

const userService = new UserService();

// Mock all methods used by the controller
const mockUserService = {
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  searchUsers: jest.fn(),
  updateProfilePhoto: jest.fn(),
  deleteProfilePhoto: jest.fn(),
  updateProfileBanner: jest.fn(),
  deleteProfileBanner: jest.fn(),
  addFcmToken: jest.fn(),
};

// Override the instance in your controller
(userController as any).userService = mockUserService;


// initial user data (plain JS object shapes)
const initialUsers: Partial<User>[] = [
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
    coverMediaId: null,
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
    profileMediaId: "default_pic_123",
    coverMediaId: null,
    dateOfBirth: new Date("2001-12-15"),
  },
];

describe("UserService + UserController Integration Tests", () => {
  let DEFAULT_PROFILE_PIC_ID: string;

  // Single shared express-style mocks for controller tests are created inside controller block
  // to avoid name shadowing. (We'll keep these minimal; controller tests use their own local mocks.)

  beforeAll(async () => {
    // Set constant from mocked getKey
    DEFAULT_PROFILE_PIC_ID = (await getKey("DEFAULT_PROFILE_PIC_ID")) as string;

    // Connect to DB (this uses your test DB as before)
    await connectToDatabase();

    // Ensure a clean starting state
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.mute.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.media.deleteMany({});

    // Create default media and other media that tests rely on
    await prisma.media.create({
      data: {
        id: DEFAULT_PROFILE_PIC_ID,
        name: "Default Profile Picture",
        keyName: "default_profile_pic",
        type: "IMAGE",
        size: 0,
      },
    });

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

  beforeEach(async () => {
    // Reset transient tables every test
    await prisma.follow.deleteMany({});
    await prisma.fcmToken.deleteMany({});
    await prisma.mute.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.user.deleteMany({});

    // Recreate initial users using separate create() calls to ensure FKs and dates are correct
    for (const u of initialUsers) {
      // Use create with explicit fields — match your schema column names
      await prisma.user.create({
        data: {
          id: u.id as string,
          username: u.username as string,
          email: u.email as string,
          password: u.password as string,
          saltPassword: u.saltPassword as string,
          name: u.name as string,
          bio: u.bio as string,
          verified: u.verified as boolean,
          protectedAccount: u.protectedAccount as boolean,
          profileMediaId: u.profileMediaId ?? null,
          coverMediaId: u.coverMediaId ?? null,
          dateOfBirth: u.dateOfBirth ?? null,
        },
      });
    }

    // Create follow relationships
    await prisma.follow.createMany({
      data: [
        { followerId: "u1", followingId: "u2" }, // u1 follows u2
        { followerId: "u2", followingId: "u1" }, // u2 follows u1
      ],
    });
  });

  afterAll(async () => {
    // Clean up and disconnect once at the very end
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
        } as any)
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

  // ===================== more standalone tests =====================
  it("should handle user without dateOfBirth", async () => {
    const NO_DOB_ID = "u4";
    try {
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

      const user = await userService.getUserProfile("no_dob_user", "u1");
      expect(user?.dateOfBirth).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: "u4" } });
    }
  });


  // ===================== Controller tests (edge cases) =====================
  describe("UserController edge cases", () => {
    // Use local controller-specific mocks to avoid shadowing top-level variables
    const ctlReqBase: any = { params: {}, body: {}, user: { id: "u1" } };
    const ctlRes: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const ctlNext = jest.fn();

    // Import controller instance (real import, not mocked) — tests cover validation/authorization
    const { userController } = require("../api/controllers/user.controller");

    beforeEach(() => {
      ctlNext.mockClear();
      ctlRes.status.mockClear();
      ctlRes.json.mockClear();
    });

    it("should return 401 if no user in request for getUserProfile", async () => {
      await userController.getUserProfile(
        { ...ctlReqBase, user: null },
        ctlRes,
        ctlNext
      );
      expect(ctlNext).toHaveBeenCalled();
      expect(ctlNext.mock.calls[0][0]).toBeInstanceOf(AppError);
    });

    it("should return 404 if user not found in getUserProfile", async () => {
      await userController.getUserProfile(
        { ...ctlReqBase, params: { username: "unknown" } },
        ctlRes,
        ctlNext
      );
      expect(ctlNext).toHaveBeenCalled();
      expect(ctlNext.mock.calls[0][0]).toBeInstanceOf(AppError);
    });

    it("should prevent updating another user's profile", async () => {
      await userController.updateUserProfile(
        { ...ctlReqBase, params: { id: "u2" }, body: {} },
        ctlRes,
        ctlNext
      );
      expect(ctlNext).toHaveBeenCalled();
      expect(ctlNext.mock.calls[0][0]).toBeInstanceOf(AppError);
    });
  });

  // ===================== extra tests added originally =====================

  it("should throw when updating username to one that already exists", async () => {
    // Attempt to change u1's username to u2's username => should throw AppError from service
    await expect(
      userService.updateUserProfile("u1", {
        username: "ahmed_samir", // belongs to u2
      } as any)
    ).rejects.toThrow();
  });

  it("should hash password when password is provided", async () => {
    const updated = await userService.updateUserProfile("u1", {
      password: "newPassword123!",
    } as any);

    const saved = await prisma.user.findUnique({ where: { id: "u1" } });

    expect(saved?.password).not.toBe("newPassword123!");
    expect(saved?.password).not.toBe(initialUsers[0].password);
    expect(saved?.password?.length).toBeGreaterThan(20);
  });


  it("should correctly return muted and blocked relationship flags", async () => {
    // Ensure users exist (beforeEach does this)
    await prisma.mute.create({
      data: { muterId: "u2", mutedId: "u1" },
    });
    await prisma.block.create({
      data: { blockerId: "u3", blockedId: "u1" },
    });

    const profileForU2 = await userService.getUserProfile(
      "mohammed_hany",
      "u2"
    );
    const profileForU3 = await userService.getUserProfile(
      "mohammed_hany",
      "u3"
    );

    expect(profileForU2?.muted).toBe(true);
    expect(profileForU2?.blocked).toBe(false);

    expect(profileForU3?.muted).toBe(false);
    expect(profileForU3?.blocked).toBe(true);
  });

  it("should throw if updating profile photo with nonexistent mediaId", async () => {
    await expect(
      userService.updateProfilePhoto("u1", "unknown_media")
    ).rejects.toThrow();
  });

  it("should throw if updating banner with invalid mediaId", async () => {
    await expect(
      userService.updateProfileBanner("u2", "not_real")
    ).rejects.toThrow();
  });


  it("should set nextCursor to null when no more users to paginate", async () => {
    const result = await userService.searchUsers("samir", "u1", 10);
    expect(result.nextCursor).toBeNull();
  });

  it("should throw when OS type is invalid", async () => {
    // @ts-ignore to intentionally send invalid argument
    await expect(
      userService.addFcmToken("u1", "tok123", "INVALID_OS" as any)
    ).rejects.toThrow();
  });

  it("should serialize dateOfBirth and joinDate to strings", async () => {
    const user = await userService.getUserProfile("mohammed_hany", "u2");
    expect(typeof user?.joinDate).toBe("string");
    if (user?.dateOfBirth) expect(typeof user.dateOfBirth).toBe("string");
  });

  it("should return error when body is empty in updateUserProfile (controller)", async () => {
    // Reuse controller import for this test
    const { userController } = require("../api/controllers/user.controller");
    const ctlReq: any = {
      params: { id: "u1" },
      body: null,
      user: { id: "u1" },
    };
    const ctlRes: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const ctlNext = jest.fn();

    await userController.updateUserProfile(ctlReq, ctlRes, ctlNext);
    expect(ctlNext).toHaveBeenCalled();
  });
});


describe("UserController – Additional Tests", () => {
  let ctlReq: any;
  let ctlRes: any;
  let ctlNext: any;

  beforeEach(() => {
    ctlReq = { params: {}, body: {}, user: { id: "u1" } };
    ctlRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    ctlNext = jest.fn();
    jest.clearAllMocks();
  });

  // ================================
  // getUserProfile
  // ================================
  it("should throw 401 if user is not authenticated", async () => {
    ctlReq.user = null;

    await userController.getUserProfile(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unauthorized access" })
    );
  });

  it("should throw 404 if user not found", async () => {
    ctlReq.params.username = "mohamed";
    mockUserService.getUserProfile.mockResolvedValueOnce(null);

    await userController.getUserProfile(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User not found" })
    );
  });

  // ================================
  // updateUserProfile
  // ================================
  it("should throw 403 if trying to update another user's profile", async () => {
    ctlReq.params.id = "other-user";
    ctlReq.user.id = "u1";

    await userController.updateUserProfile(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Forbidden: you can only update your own profile",
      })
    );
  });


  // ================================
  // searchUsers
  // ================================
  it("should throw 400 on invalid query params", async () => {
    ctlReq.user.id = "u1";
    ctlReq.query = { query: 123 }; // must be string

    await userController.searchUsers(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid query parameters" })
    );
  });

  // ================================
  // updateUserProfilePicture
  // ================================
  it("should throw 400 for invalid mediaId param", async () => {
    ctlReq.params = { mediaId: 999 }; // must be string/uuid

    await userController.updateUserProfilePicture(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid request parameters" })
    );
  });

  // ================================
  // deleteUserProfilePicture
  // ================================
  it("should throw 401 if unauthenticated when deleting profile picture", async () => {
    ctlReq.user = null;

    await userController.deleteUserProfilePicture(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unauthorized: user not authenticated",
      })
    );
  });

  // ================================
  // updateUserBanner
  // ================================
  it("should throw 400 for invalid banner params", async () => {
    ctlReq.params = { mediaId: 12 }; // invalid type

    await userController.updateUserBanner(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid request parameters" })
    );
  });

  // ================================
  // addFcmToken
  // ================================
  it("should throw 400 when FCM body fails validation", async () => {
    ctlReq.body = { token: 123, osType: "invalid" }; // wrong types

    await userController.addFcmToken(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid request body" })
    );
  });

  it("should throw 404 when deleting profile picture for nonexistent user", async () => {
    ctlReq.user.id = "nonexistent";

    mockUserService.deleteProfilePhoto.mockImplementationOnce(() => {
      throw new AppError("User not found", 404);
    });

    await userController.deleteUserProfilePicture(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User not found", statusCode: 404 })
    );
  });

  it("should throw 400 when adding FCM token with missing token field", async () => {
    ctlReq.body = { osType: OSType.ANDROID }; // missing token

    await userController.addFcmToken(ctlReq, ctlRes, ctlNext);

    expect(ctlNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid request body" })
    );
  });
});
