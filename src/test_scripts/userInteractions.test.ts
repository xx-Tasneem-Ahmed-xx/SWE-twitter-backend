import * as userInteractionsService from "@/application/services/userInteractions";
import { prisma, FollowStatus } from "@/prisma/client";
import { connectToDatabase } from "@/database";
import { FollowsListResponseSchema } from "@/application/dtos/userInteractions/userInteraction.dto.schema";

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

  // Clean up and close connection
  afterAll(async () => {
    await prisma.mute.deleteMany();
    await prisma.block.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany({
      where: { id: { in: ["123", "456", "789"] } },
    });
    await prisma.media.deleteMany({
      where: { id: { in: ["media1", "media2", "media3"] } },
    });
    await prisma.$disconnect();
  });

  // Clean up relationships before each test
  beforeEach(async () => {
    await prisma.mute.deleteMany();
    await prisma.block.deleteMany();
    await prisma.follow.deleteMany();
  });

  // Tests for findUserByUsername
  describe("findUserByUsername", () => {
    it("should find a user by username", async () => {
      const result = await userInteractionsService.findUserByUsername(
        "test_user1"
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe("123");
      expect(result?.protectedAccount).toBe(false);
    });

    it("should return null if user not found", async () => {
      const result = await userInteractionsService.findUserByUsername(
        "notfound_user"
      );
      expect(result).toBeNull();
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
      ).rejects.toThrow("Already following this user");
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
        "456",
        "ACCEPTED"
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
      expect(followerOne.photo).toBe("https://example.com/photo2.jpg");
      expect(followerOne.verified).toBe(true);
      expect(followerOne.isFollowing).toBe(false);
      expect(followerOne.isFollower).toBe(false);

      expect(followerTwo.username).toBe("test_user3");
      expect(followerTwo.name).toBe("Test User Three");
      expect(followerTwo.bio).toBe("I am test user three");
      expect(followerTwo.photo).toBe("https://example.com/photo3.jpg");
      expect(followerTwo.verified).toBe(true);
      expect(followerTwo.isFollowing).toBe(false);
      expect(followerTwo.isFollower).toBe(true);
    });
  });

  // Tests for getFollowRequestsList
  describe("getFollowRequestsList", () => {
    it("should return empty list when there are no follow requests", async () => {
      const result = await userInteractionsService.getFollowersList(
        "123",
        "456",
        "PENDING"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result.users).toHaveLength(0);
    });

    it("should return list of follow requests", async () => {
      await userInteractionsService.createFollowRelation(
        "456",
        "123",
        "PENDING"
      );
      await userInteractionsService.createFollowRelation(
        "789",
        "123",
        "ACCEPTED"
      );

      // Get follow requests list for user 1
      const result = await userInteractionsService.getFollowersList(
        "123",
        "123",
        "PENDING"
      );
      expect(() => FollowsListResponseSchema.parse(result)).not.toThrow();
      expect(result).not.toBeNull();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(1);

      const requestUser = result.users[0];
      expect(requestUser.username).toBe("test_user2");
      expect(requestUser.name).toBe("Test User Two");
      expect(requestUser.bio).toBe("I am test user two");
      expect(requestUser.photo).toBe("https://example.com/photo2.jpg");
      expect(requestUser.verified).toBe(true);
      expect(requestUser.isFollowing).toBe(false);
      expect(requestUser.isFollower).toBe(false);
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
      expect(followingOne.photo).toBe("https://example.com/photo2.jpg");
      expect(followingOne.verified).toBe(true);
      expect(followingOne.isFollowing).toBe(false);
      expect(followingOne.isFollower).toBe(false);

      expect(followingTwo.username).toBe("test_user3");
      expect(followingTwo.name).toBe("Test User Three");
      expect(followingTwo.bio).toBe("I am test user three");
      expect(followingTwo.photo).toBe("https://example.com/photo3.jpg");
      expect(followingTwo.verified).toBe(true);
      expect(followingTwo.isFollowing).toBe(false);
      expect(followingTwo.isFollower).toBe(true);
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
      expect(blockedUser.photo).toBe("https://example.com/photo2.jpg");
      expect(blockedUser.verified).toBe(true);
      expect(blockedUser.isFollowing).toBe(false);
      expect(blockedUser.isFollower).toBe(false);
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
      expect(mutedUser.photo).toBe("https://example.com/photo2.jpg");
      expect(mutedUser.verified).toBe(true);
      expect(mutedUser.isFollowing).toBe(false);
      expect(mutedUser.isFollower).toBe(false);
    });
  });
});
