jest.mock("@/api/controllers/notificationController", () => ({
  getNotificationList: jest.fn(),
  getMentionNotifications: jest.fn(),
  getUnseenNotificationsCount: jest.fn(),
  getUnseenNotifications: jest.fn(),
  markNotificationsAsRead: jest.fn(),
  addNotification: jest.fn(),
}));

jest.mock("@/application/services/notification", () => ({
  addNotification: jest.fn(),
  sendOverFCM: jest.fn(),
  sendOverSocket: jest.fn(),
}));

import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma, FollowStatus } from "@/prisma/client";

let connectToDatabase: any;
let userInteractionsService: any;
let resolveUsernameToId: any;
let FollowsListResponseSchema: any;
let AppError: any;

// Suppress console.error output during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeAll(async () => {
  await initRedis();
  await loadSecrets();

  connectToDatabase = (await import("@/database")).connectToDatabase;

  // All imports that transitively require secrets MUST BE DYNAMIC

  userInteractionsService = await import(
    "@/application/services/userInteractions"
  );

  resolveUsernameToId = (await import("@/application/utils/utils"))
    .resolveUsernameToId;

  FollowsListResponseSchema = (
    await import(
      "@/application/dtos/userInteractions/userInteraction.dto.schema"
    )
  ).FollowsListResponseSchema;

  AppError = (await import("@/errors/AppError")).AppError;
});

describe("User Interactions Service", () => {
  beforeAll(async () => {
    await connectToDatabase();
    console.log("Running tests with real database connection");

    // Create media records first
    const media1 = await prisma.media.create({
      data: {
        id: "media1",
        name: "profile1.jpg",
        keyName: "https://example.com/photo1.jpg",
        type: "IMAGE",
      },
    });

    const media2 = await prisma.media.create({
      data: {
        id: "media2",
        name: "profile2.jpg",
        keyName: "https://example.com/photo2.jpg",
        type: "IMAGE",
      },
    });

    const media3 = await prisma.media.create({
      data: {
        id: "media3",
        name: "profile3.jpg",
        keyName: "https://example.com/photo3.jpg",
        type: "IMAGE",
      },
    });

    await prisma.user.upsert({
      where: { username: "test_user1" },
      update: {},
      create: {
        username: "test_user1",
        id: "123",
        email: "test_user1@example.com",
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("2025-11-21"),
        name: "Test User One",
        profileMediaId: "media1",
        bio: "I am test user one",
        verified: true,
        protectedAccount: false,
      },
    });
    await prisma.user.upsert({
      where: { username: "test_user2" },
      update: {},
      create: {
        username: "test_user2",
        id: "456",
        email: "test_user2@example.com",
        password: "password456",
        saltPassword: "salt456",
        dateOfBirth: new Date("2025-10-21"),
        name: "Test User Two",
        profileMediaId: "media2",
        bio: "I am test user two",
        verified: true,
        protectedAccount: false,
      },
    });
    await prisma.user.upsert({
      where: { username: "test_user3" },
      update: {},
      create: {
        username: "test_user3",
        id: "789",
        email: "test_user3@example.com",
        password: "password789",
        saltPassword: "salt789",
        dateOfBirth: new Date("2025-09-21"),
        name: "Test User Three",
        profileMediaId: "media3",
        bio: "I am test user three",
        verified: true,
        protectedAccount: false,
      },
    });
  });

  // Clean up and close connection (only remove relations involving test users)
  afterAll(async () => {
    const TEST_USER_IDS = ["123", "456", "789"];
    await prisma.mute.deleteMany({
      where: {
        OR: [
          { muterId: { in: TEST_USER_IDS } },
          { mutedId: { in: TEST_USER_IDS } },
        ],
      },
    });
    await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: TEST_USER_IDS } },
          { blockedId: { in: TEST_USER_IDS } },
        ],
      },
    });
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: TEST_USER_IDS } },
          { followingId: { in: TEST_USER_IDS } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: TEST_USER_IDS } },
    });
    await prisma.media.deleteMany({
      where: { id: { in: ["media1", "media2", "media3"] } },
    });
    await prisma.$disconnect();
  });

  // Clean up relationships before each test (only those involving test users)
  beforeEach(async () => {
    const TEST_USER_IDS = ["123", "456", "789"];
    await prisma.mute.deleteMany({
      where: {
        OR: [
          { muterId: { in: TEST_USER_IDS } },
          { mutedId: { in: TEST_USER_IDS } },
        ],
      },
    });
    await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: TEST_USER_IDS } },
          { blockedId: { in: TEST_USER_IDS } },
        ],
      },
    });
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: TEST_USER_IDS } },
          { followingId: { in: TEST_USER_IDS } },
        ],
      },
    });
  });

  // Tests for findUserByUsername
  describe("findUserByUsername", () => {
    it("should find a user by username", async () => {
      const result = await resolveUsernameToId("test_user1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("123");
      expect(result?.protectedAccount).toBe(false);
    });

    it("should throw if user not found", async () => {
      await expect(resolveUsernameToId("notfound_user")).rejects.toThrow(
        "User not found"
      );
    });
  });

  // Tests for createFollowRelation
  describe("createFollowRelation", () => {
    it("should create an accepted follow relation", async () => {
      const result = await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      expect(result).not.toBeNull();
      expect(result.followerId).toBe("123");
      expect(result.followingId).toBe("456");
      expect(result.status).toBe("ACCEPTED");

      const savedFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "123",
            followingId: "456",
          },
        },
      });
      expect(savedFollow).not.toBeNull();
      expect(savedFollow?.status).toBe("ACCEPTED");
    });

    it("should create a pending follow relation", async () => {
      const pendingResult = await userInteractionsService.createFollowRelation(
        "456",
        "123",
        "PENDING"
      );
      expect(pendingResult).not.toBeNull();
      expect(pendingResult.followerId).toBe("456");
      expect(pendingResult.followingId).toBe("123");
      expect(pendingResult.status).toBe("PENDING");

      const savedPendingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "456",
            followingId: "123",
          },
        },
      });
      expect(savedPendingFollow).not.toBeNull();
      expect(savedPendingFollow?.status).toBe("PENDING");
    });

    it("should throw an error if already following", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      await expect(
        userInteractionsService.createFollowRelation("123", "456", "ACCEPTED")
      ).rejects.toThrow("You are already following this user");
    });
  });

  // Tests for removeFollowRelation
  describe("removeFollowRelation", () => {
    it("should delete a follow relation", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      const result = await userInteractionsService.removeFollowRelation(
        "123",
        "456"
      );
      expect(result).not.toBeNull();
      expect(result.followerId).toBe("123");
      expect(result.followingId).toBe("456");

      const deletedFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "123",
            followingId: "456",
          },
        },
      });
      expect(deletedFollow).toBeNull();
    });
  });

  // Tests for updateFollowStatus
  describe("updateFollowStatus", () => {
    it("should update follow status to ACCEPTED", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "PENDING"
      );
      const updatedFollow = await userInteractionsService.updateFollowStatus(
        "123",
        "456"
      );
      expect(updatedFollow).not.toBeNull();
      expect(updatedFollow.followerId).toBe("123");
      expect(updatedFollow.followingId).toBe("456");
      expect(updatedFollow.status).toBe("ACCEPTED");

      const savedFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "123",
            followingId: "456",
          },
        },
      });
      expect(savedFollow).not.toBeNull();
      expect(savedFollow?.status).toBe("ACCEPTED");
    });
  });

  // Tests for isAlreadyFollowing
  describe("isAlreadyFollowing", () => {
    it("should return null if not following", async () => {
      const initialResult = await userInteractionsService.isAlreadyFollowing(
        "123",
        "456"
      );
      expect(initialResult).toBeNull();
    });

    it("should return follow relation if exists", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      const result = await userInteractionsService.isAlreadyFollowing(
        "123",
        "456"
      );
      expect(result).not.toBeNull();
      expect(result?.followerId).toBe("123");
      expect(result?.followingId).toBe("456");
      expect(result?.status).toBe("ACCEPTED");
    });
  });

  // Test for createBlockRelation
  describe("createBlockRelation", () => {
    it("should create a block relation and delete existing follow and mute relations", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      await userInteractionsService.createMuteRelation("123", "456");
      const initialFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "123",
            followingId: "456",
          },
        },
      });
      expect(initialFollow).not.toBeNull();

      const initialMute = await prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: "123",
            mutedId: "456",
          },
        },
      });
      expect(initialMute).not.toBeNull();

      const result = await userInteractionsService.createBlockRelation(
        "123",
        "456"
      );
      expect(result).not.toBeNull();
      expect(result.blockerId).toBe("123");
      expect(result.blockedId).toBe("456");
      const deletedFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: "123",
            followingId: "456",
          },
        },
      });
      expect(deletedFollow).toBeNull();
      const deletedMute = await prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: "123",
            mutedId: "456",
          },
        },
      });
      expect(deletedMute).toBeNull();
    });

    it("should create a block relation without existing relationships", async () => {
      const result = await userInteractionsService.createBlockRelation(
        "456",
        "123"
      );
      expect(result).not.toBeNull();
      expect(result.blockerId).toBe("456");
      expect(result.blockedId).toBe("123");
    });
  });

  // Test for checkBlockStatus
  describe("checkBlockStatus", () => {
    it("should return false if no blocks exist", async () => {
      const result = await userInteractionsService.checkBlockStatus(
        "123",
        "456"
      );
      expect(result).toBe(false);
    });

    it("should return true if users have blocked each other", async () => {
      await userInteractionsService.createBlockRelation("123", "456");
      const result = await userInteractionsService.checkBlockStatus(
        "123",
        "456"
      );
      expect(result).toBe(true);
    });
  });

  // Test for createMuteRelation
  describe("createMuteRelation", () => {
    it("should create a mute relation", async () => {
      const result = await userInteractionsService.createMuteRelation(
        "123",
        "456"
      );
      expect(result).not.toBeNull();
      expect(result.muterId).toBe("123");
      expect(result.mutedId).toBe("456");

      const savedMute = await prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: "123",
            mutedId: "456",
          },
        },
      });
      expect(savedMute).not.toBeNull();
    });
  });

  // Test for checkMuteStatus
  describe("checkMuteStatus", () => {
    it("should return false if user is not muted", async () => {
      const result = await userInteractionsService.checkMuteStatus(
        "123",
        "456"
      );
      expect(result).toBe(false);
    });

    it("should return true if user is muted", async () => {
      await userInteractionsService.createMuteRelation("123", "456");
      const result = await userInteractionsService.checkMuteStatus(
        "123",
        "456"
      );
      expect(result).toBe(true);
    });
  });

  // Test for removeMuteRelation
  describe("removeMuteRelation", () => {
    it("should delete a mute relation", async () => {
      await userInteractionsService.createMuteRelation("123", "456");
      const initialMute = await prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: "123",
            mutedId: "456",
          },
        },
      });
      expect(initialMute).not.toBeNull();

      await userInteractionsService.removeMuteRelation("123", "456");
      const deletedMute = await prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: "123",
            mutedId: "456",
          },
        },
      });
      expect(deletedMute).toBeNull();
    });
  });

  // Tests for getFollowersList
  describe("getFollowersList", () => {
    it("should return empty list when user has no followers", async () => {
      const result = await userInteractionsService.getFollowersList(
        "123",
        "456",
        "ACCEPTED"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result.users).toHaveLength(0);
    });

    it("should return list of followers with mutual follow info", async () => {
      await userInteractionsService.createFollowRelation(
        "456",
        "123",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "789",
        "123",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "789",
        "456",
        "ACCEPTED"
      );
      // Get followers list for user 1 from perspective of user 2
      const result = await userInteractionsService.getFollowersList(
        "123",
        "456"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result).not.toBeNull();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(2);
      const followerOne = result.users[0];
      const followerTwo = result.users[1];

      expect(followerOne.username).toBe("test_user2");
      expect(followerOne.name).toBe("Test User Two");
      expect(followerOne.bio).toBe("I am test user two");
      expect(followerOne.photo).toBe("media2");
      expect(followerOne.verified).toBe(true);
      expect(followerOne.isFollowing).toBe(false);
      expect(followerOne.isFollower).toBe(false);
      expect(followerOne.youRequested).toBe(false);
      expect(followerOne.followStatus).toBe(FollowStatus.ACCEPTED);

      expect(followerTwo.username).toBe("test_user3");
      expect(followerTwo.name).toBe("Test User Three");
      expect(followerTwo.bio).toBe("I am test user three");
      expect(followerTwo.photo).toBe("media3");
      expect(followerTwo.verified).toBe(true);
      expect(followerTwo.isFollowing).toBe(false);
      expect(followerTwo.isFollower).toBe(true);
      expect(followerTwo.youRequested).toBe(false);
      expect(followerTwo.followStatus).toBe(FollowStatus.ACCEPTED);
    });
  });

  // Tests for getFollowingsList
  describe("getFollowingsList", () => {
    it("should return empty list when user is not following anyone", async () => {
      const result = await userInteractionsService.getFollowingsList(
        "123",
        "456"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result.users).toHaveLength(0);
    });

    it("should return list of users being followed with mutual follow info", async () => {
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "123",
        "789",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "789",
        "456",
        "ACCEPTED"
      );

      // Get followings list for user 1 from perspective of user 2
      const result = await userInteractionsService.getFollowingsList(
        "123",
        "456"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result).not.toBeNull();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(2);
      const followingOne = result.users[0];
      const followingTwo = result.users[1];

      expect(followingOne.username).toBe("test_user2");
      expect(followingOne.name).toBe("Test User Two");
      expect(followingOne.bio).toBe("I am test user two");
      expect(followingOne.photo).toBe("media2");
      expect(followingOne.verified).toBe(true);
      expect(followingOne.isFollowing).toBe(false);
      expect(followingOne.isFollower).toBe(false);
      expect(followingOne.youRequested).toBe(false);
      expect(followingOne.followStatus).toBe(FollowStatus.ACCEPTED);

      expect(followingTwo.username).toBe("test_user3");
      expect(followingTwo.name).toBe("Test User Three");
      expect(followingTwo.bio).toBe("I am test user three");
      expect(followingTwo.photo).toBe("media3");
      expect(followingTwo.verified).toBe(true);
      expect(followingTwo.isFollowing).toBe(false);
      expect(followingTwo.isFollower).toBe(true);
      expect(followingTwo.youRequested).toBe(false);
      expect(followingTwo.followStatus).toBe(FollowStatus.ACCEPTED);
    });
  });

  // Tests for getBlockedList
  describe("getBlockedList", () => {
    it("should return empty list when user has not blocked anyone", async () => {
      const result = await userInteractionsService.getBlockedList("123");
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result.users).toHaveLength(0);
    });

    it("should return list of blocked users", async () => {
      const block = await userInteractionsService.createBlockRelation(
        "123",
        "456"
      );
      const result = await userInteractionsService.getBlockedList("123");
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result).not.toBeNull();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(1);

      const blockedUser = result.users[0];
      expect(blockedUser.username).toBe("test_user2");
      expect(blockedUser.name).toBe("Test User Two");
      expect(blockedUser.bio).toBe("I am test user two");
      expect(blockedUser.photo).toBe("media2");
      expect(blockedUser.verified).toBe(true);
      expect(blockedUser.isFollowing).toBe(false);
      expect(blockedUser.isFollower).toBe(false);
      expect(blockedUser.youRequested).toBe(false);
      expect(blockedUser.followStatus).toBe("NONE");
    });
  });

  // Tests for getMutedList
  describe("getMutedList", () => {
    it("should return empty list when user has not muted anyone", async () => {
      const result = await userInteractionsService.getMutedList("123");
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result.users).toHaveLength(0);
    });

    it("should return list of muted users", async () => {
      const mute = await userInteractionsService.createMuteRelation(
        "123",
        "456"
      );
      const follow = await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      // Get muted list for user 1
      const result = await userInteractionsService.getMutedList("123");

      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result).not.toBeNull();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(1);

      const mutedUser = result.users[0];
      expect(mutedUser.username).toBe("test_user2");
      expect(mutedUser.name).toBe("Test User Two");
      expect(mutedUser.bio).toBe("I am test user two");
      expect(mutedUser.photo).toBe("media2");
      expect(mutedUser.verified).toBe(true);
      expect(mutedUser.isFollowing).toBe(true);
      expect(mutedUser.isFollower).toBe(false);
      expect(mutedUser.youRequested).toBe(false);
      expect(mutedUser.followStatus).toBe(FollowStatus.ACCEPTED);
    });
  });

  describe("createFollowRelationAndNotify", () => {
    it("should create an accepted follow relation", async () => {
      const follow =
        await userInteractionsService.createFollowRelationAndNotify(
          "123",
          "456",
          "ACCEPTED",
          "test_user1"
        );

      expect(follow).not.toBeNull();
      expect(follow.followerId).toBe("123");
      expect(follow.followingId).toBe("456");
      expect(follow.status).toBe(FollowStatus.ACCEPTED);
    });

    it("should create a pending follow relation", async () => {
      const follow =
        await userInteractionsService.createFollowRelationAndNotify(
          "123",
          "456",
          "PENDING",
          "test_user1"
        );

      expect(follow).not.toBeNull();
      expect(follow.followerId).toBe("123");
      expect(follow.followingId).toBe("456");
      expect(follow.status).toBe(FollowStatus.PENDING);
    });

    it("should throw error if already following", async () => {
      // Create initial follow
      await userInteractionsService.createFollowRelationAndNotify(
        "123",
        "456",
        "ACCEPTED"
      );

      // Try to follow again
      await expect(
        userInteractionsService.createFollowRelationAndNotify(
          "123",
          "456",
          "ACCEPTED"
        )
      ).rejects.toThrow("You are already following this user");
    });
  });

  describe("updateFollowStatusAndNotify", () => {
    it("should update follow status to ACCEPTED", async () => {
      // First create a pending follow
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "PENDING"
      );

      const updated = await userInteractionsService.updateFollowStatusAndNotify(
        "123",
        "456",
        "test_user2"
      );

      expect(updated).not.toBeNull();
      expect(updated.status).toBe(FollowStatus.ACCEPTED);
      expect(updated.followerId).toBe("123");
      expect(updated.followingId).toBe("456");
    });

    it("should update multiple pending follow requests", async () => {
      // Create pending follows
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "PENDING"
      );
      await userInteractionsService.createFollowRelation(
        "789",
        "456",
        "PENDING"
      );

      // Accept first request
      const updated1 =
        await userInteractionsService.updateFollowStatusAndNotify("123", "456");
      expect(updated1.status).toBe(FollowStatus.ACCEPTED);

      // Accept second request
      const updated2 =
        await userInteractionsService.updateFollowStatusAndNotify("789", "456");
      expect(updated2.status).toBe(FollowStatus.ACCEPTED);
    });
  });

  describe("removeBlockRelation", () => {
    it("should successfully remove a block relation", async () => {
      // First create a block
      await userInteractionsService.createBlockRelation("123", "456");

      // Verify block exists
      const blockExists = await userInteractionsService.checkBlockStatus(
        "123",
        "456"
      );
      expect(blockExists).toBe(true);

      // Remove the block
      await userInteractionsService.removeBlockRelation("123", "456");

      // Verify block is removed
      const blockStillExists = await userInteractionsService.checkBlockStatus(
        "123",
        "456"
      );
      expect(blockStillExists).toBe(false);
    });

    it("should throw error when trying to remove non-existent block", async () => {
      await expect(
        userInteractionsService.removeBlockRelation("123", "999")
      ).rejects.toThrow("Failed to remove block relation");
    });
  });

  describe("isAlreadyFollowingBatch", () => {
    it("should return empty set for empty array", async () => {
      const result = await userInteractionsService.isAlreadyFollowingBatch(
        "123",
        []
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should return set of following user IDs", async () => {
      // Create some follow relations
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "123",
        "789",
        "ACCEPTED"
      );

      const result = await userInteractionsService.isAlreadyFollowingBatch(
        "123",
        ["456", "789", "999"]
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has("456")).toBe(true);
      expect(result.has("789")).toBe(true);
      expect(result.has("999")).toBe(false);
    });

    it("should filter by status when provided", async () => {
      // Create different status follows
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );
      await userInteractionsService.createFollowRelation(
        "123",
        "789",
        "PENDING"
      );

      // Check only ACCEPTED
      const acceptedResult =
        await userInteractionsService.isAlreadyFollowingBatch(
          "123",
          ["456", "789"],
          FollowStatus.ACCEPTED
        );

      expect(acceptedResult.size).toBe(1);
      expect(acceptedResult.has("456")).toBe(true);
      expect(acceptedResult.has("789")).toBe(false);

      // Check only PENDING
      const pendingResult =
        await userInteractionsService.isAlreadyFollowingBatch(
          "123",
          ["456", "789"],
          FollowStatus.PENDING
        );

      expect(pendingResult.size).toBe(1);
      expect(pendingResult.has("456")).toBe(false);
      expect(pendingResult.has("789")).toBe(true);
    });

    it("should handle null or undefined followingIds gracefully", async () => {
      const result = await userInteractionsService.isAlreadyFollowingBatch(
        "123",
        null as any
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe("fetchWhoToFollow", () => {
    it("should return users not already followed", async () => {
      // User 123 follows user 456
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "ACCEPTED"
      );

      const result = await userInteractionsService.fetchWhoToFollow("123", 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should not include user 456 (already followed) or user 123 (self)
      const userIds = result.map((u: any) => u.id);
      expect(userIds).not.toContain("123");
      expect(userIds).not.toContain("456");
    });

    it("should respect the limit parameter", async () => {
      const result = await userInteractionsService.fetchWhoToFollow("123", 2);

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("should return users with correct format", async () => {
      const result = await userInteractionsService.fetchWhoToFollow("123", 5);

      if (result.length > 0) {
        const user = result[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("username");
        expect(user).toHaveProperty("bio");
        expect(user).toHaveProperty("profileMedia");
        expect(user).toHaveProperty("verified");
        expect(user).toHaveProperty("followersCount");
        expect(user).toHaveProperty("isFollowed");
        expect(user.isFollowed).toBe(false);
      }
    });

    it("should exclude users with pending follow requests", async () => {
      // User 123 sent pending request to user 789
      await userInteractionsService.createFollowRelation(
        "123",
        "789",
        "PENDING"
      );

      const result = await userInteractionsService.fetchWhoToFollow("123", 10);

      const userIds = result.map((u: any) => u.id);
      expect(userIds).not.toContain("789");
    });

    it("should return users sorted by follower count", async () => {
      const result = await userInteractionsService.fetchWhoToFollow("123", 10);

      // Verify sorting by follower count (descending)
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].followersCount).toBeGreaterThanOrEqual(
            result[i + 1].followersCount
          );
        }
      }
    });

    it("should exclude users that the current user has blocked", async () => {
      // User 123 blocks user 456
      await userInteractionsService.createBlockRelation("123", "456");

      const result = await userInteractionsService.fetchWhoToFollow("123", 10);

      const userIds = result.map((u: any) => u.id);
      expect(userIds).not.toContain("456");

      // Cleanup: unblock user
      await userInteractionsService.removeBlockRelation("123", "456");
    });

    it("should exclude users who have blocked the current user", async () => {
      // User 456 blocks user 123
      await userInteractionsService.createBlockRelation("456", "123");

      const result = await userInteractionsService.fetchWhoToFollow("123", 10);

      const userIds = result.map((u: any) => u.id);
      expect(userIds).not.toContain("456");

      // Cleanup: unblock user
      await userInteractionsService.removeBlockRelation("456", "123");
    });

    it("should exclude users that the current user has muted", async () => {
      // User 123 mutes user 789
      await userInteractionsService.createMuteRelation("123", "789");

      const result = await userInteractionsService.fetchWhoToFollow("123", 10);

      const userIds = result.map((u: any) => u.id);
      expect(userIds).not.toContain("789");

      // Cleanup: unmute user
      await userInteractionsService.removeMuteRelation("123", "789");
    });

    it("should exclude multiple blocked, blocking, and muted users simultaneously", async () => {
      // Setup: User 123 blocks 456, 789 blocks 123, and 123 mutes another user
      await userInteractionsService.createBlockRelation("123", "456");
      await userInteractionsService.createBlockRelation("789", "123");

      // Create a test user to mute
      await prisma.user.upsert({
        where: { username: "muted_user" },
        update: {},
        create: {
          username: "muted_user",
          id: "muted_test_id",
          email: "muted@example.com",
          password: "password123",
          saltPassword: "salt123",
          dateOfBirth: new Date("2000-01-01"),
          name: "Muted User",
          verified: false,
          protectedAccount: false,
        },
      });

      await userInteractionsService.createMuteRelation("123", "muted_test_id");

      const result = await userInteractionsService.fetchWhoToFollow("123", 20);

      const userIds = result.map((u: any) => u.id);

      // Should not include any blocked, blocking, or muted users
      expect(userIds).not.toContain("456"); // blocked by 123
      expect(userIds).not.toContain("789"); // blocked 123
      expect(userIds).not.toContain("muted_test_id"); // muted by 123

      // Cleanup
      await userInteractionsService.removeBlockRelation("123", "456");
      await userInteractionsService.removeBlockRelation("789", "123");
      await userInteractionsService.removeMuteRelation("123", "muted_test_id");
      await prisma.user.delete({ where: { id: "muted_test_id" } });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in createFollowRelation", async () => {
      // Mock prisma to throw a non-P2002 error
      const originalCreate = prisma.follow.create;
      prisma.follow.create = jest
        .fn()
        .mockRejectedValue(new Error("Database connection error"));

      await expect(
        userInteractionsService.createFollowRelation("123", "456", "ACCEPTED")
      ).rejects.toThrow("Database connection error");

      // Restore original function
      prisma.follow.create = originalCreate;
    });

    it("should handle notification errors gracefully in createFollowRelationAndNotify", async () => {
      const { addNotification } = await import(
        "@/application/services/notification"
      );

      // Mock notification to fail
      (addNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Notification service unavailable")
      );

      // Should still create follow relation even if notification fails
      const result =
        await userInteractionsService.createFollowRelationAndNotify(
          "123",
          "456",
          "ACCEPTED"
        );

      expect(result).toBeDefined();
      expect(result.followerId).toBe("123");
      expect(result.followingId).toBe("456");

      // Cleanup
      await userInteractionsService.removeFollowRelation("123", "456");
    });

    it("should handle notification errors gracefully in updateFollowStatusAndNotify", async () => {
      const { addNotification } = await import(
        "@/application/services/notification"
      );

      // Create pending follow request
      await userInteractionsService.createFollowRelation(
        "123",
        "456",
        "PENDING"
      );

      // Mock notification to fail
      (addNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Notification service unavailable")
      );

      // Should still accept request even if notification fails
      const result = await userInteractionsService.updateFollowStatusAndNotify(
        "123",
        "456"
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(FollowStatus.ACCEPTED);

      await userInteractionsService.removeFollowRelation("123", "456");
    });

    it("should handle errors in createBlockRelation", async () => {
      // Mock prisma to throw an error
      const originalTransaction = prisma.$transaction;
      prisma.$transaction = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await expect(
        userInteractionsService.createBlockRelation("123", "456")
      ).rejects.toThrow(AppError);

      // Restore original function
      prisma.$transaction = originalTransaction;
    });

    it("should handle errors in createMuteRelation", async () => {
      // Mock prisma to throw an error
      const originalCreate = prisma.mute.create;
      prisma.mute.create = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await expect(
        userInteractionsService.createMuteRelation("123", "456")
      ).rejects.toThrow(AppError);

      prisma.mute.create = originalCreate;
    });

    it("should handle errors in removeMuteRelation", async () => {
      // Mock prisma to throw an error
      const originalDelete = prisma.mute.delete;
      prisma.mute.delete = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await expect(
        userInteractionsService.removeMuteRelation("123", "456")
      ).rejects.toThrow(AppError);

      prisma.mute.delete = originalDelete;
    });
  });

  describe("Edge Cases", () => {
    it("should return null cursor when page is empty", async () => {
      const result = await userInteractionsService.getFollowingsList(
        "nonexistent_user_id",
        "123",
        undefined,
        10
      );

      expect(result.nextCursor).toBeNull();
      expect(result.users).toHaveLength(0);
    });

    it("should handle empty array in getRelationToTargetStatuses", async () => {
      const testUserId = "empty_follow_test_789";
      await prisma.user.create({
        data: {
          id: testUserId,
          username: "empty_follow_user_789",
          email: "empty789@example.com",
          password: "password",
          saltPassword: "salt",
          dateOfBirth: new Date("2000-01-01"),
          name: "Empty Follow User",
        },
      });

      const result = await userInteractionsService.getFollowingsList(
        testUserId,
        "123",
        undefined,
        10
      );

      expect(result.users).toHaveLength(0);
      expect(result.nextCursor).toBeNull();

      await prisma.user.delete({ where: { id: testUserId } });
    });

    it("should handle computeNextCursor when nextUser is null", async () => {
      // This tests the ternary operator branch in computeNextCursor
      // We create users that follow each other, then test pagination
      const testUserId1 = "cursor_test_user1";
      const testUserId2 = "cursor_test_user2";

      await prisma.user.create({
        data: {
          id: testUserId1,
          username: "cursor_test_user1",
          email: "cursor1@example.com",
          password: "password",
          saltPassword: "salt",
          dateOfBirth: new Date("2000-01-01"),
          name: "Cursor Test User 1",
        },
      });

      await prisma.user.create({
        data: {
          id: testUserId2,
          username: "cursor_test_user2",
          email: "cursor2@example.com",
          password: "password",
          saltPassword: "salt",
          dateOfBirth: new Date("2000-01-01"),
          name: "Cursor Test User 2",
        },
      });

      // User 2 follows user 123
      await userInteractionsService.createFollowRelation(
        testUserId2,
        "123",
        "ACCEPTED"
      );

      // Get followers of user 123 (should include user 2)
      const result = await userInteractionsService.getFollowersList(
        "123",
        "123",
        undefined,
        1
      );

      expect(result.users.length).toBeGreaterThan(0);

      await userInteractionsService.removeFollowRelation(testUserId2, "123");
      await prisma.user.delete({ where: { id: testUserId1 } });
      await prisma.user.delete({ where: { id: testUserId2 } });
    });
  });
});
