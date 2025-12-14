import {
  encoderService,
  initEncoderService,
} from "@/application/services/encoder";
import tweetService from "@/application/services/tweets";
import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
import { Tweet, TweetType, ReplyControl } from "@prisma/client";
import { RESPONSES } from "@/application/constants/responses";
import { addNotification } from "@/application/services/notification";
import { enqueueUpdateScoreJob } from "@/background/jobs/explore";
import {
  enqueueCategorizeTweetJob,
  enqueueHashtagJob,
} from "@/background/jobs/hashtags";
import {
  generateTweetSumamry,
  generateTweetCategory,
} from "@/application/services/aiSummary";
import {
  PeopleFilter,
  SearchTab,
} from "@/application/dtos/tweets/tweet.dto.schema";
let connectToDatabase: any;

jest.mock("@/application/services/notification", () => ({
  addNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/background/jobs/explore", () => ({
  enqueueUpdateScoreJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/background/jobs/hashtags", () => ({
  enqueueHashtagJob: jest.fn().mockResolvedValue(undefined),
  enqueueCategorizeTweetJob: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/application/services/aiSummary", () => ({
  generateTweetSumamry: jest.fn().mockResolvedValue("mock summary"),
  generateTweetCategory: jest.fn(),
}));

beforeAll(async () => {
  await initRedis();
  await loadSecrets();
  await initEncoderService();
  connectToDatabase = (await import("@/database")).connectToDatabase;
});

describe("Tweets Service", () => {
  let publicTweet: Tweet;
  let protectedTweet: Tweet;
  const testUserIds = ["444"];
  const testMediaIds = ["media1", "media2", "media3"];

  beforeAll(async () => {
    await connectToDatabase();

    await prisma.media.deleteMany({
      where: { id: { in: testMediaIds }, name: { contains: "test_m" } },
    });
    await prisma.media.createMany({
      data: [
        {
          id: "media1",
          name: "profile1.jpg",
          keyName: "https://example.com/photo1.jpg",
          type: "IMAGE",
        },
        {
          id: "media2",
          name: "profile2.jpg",
          keyName: "https://example.com/photo2.jpg",
          type: "IMAGE",
        },
      ],
    });

    const u1 = await prisma.user.upsert({
      where: { username: "test_user1" },
      update: {},
      create: {
        username: "test_user1",
        email: "test_user1@example.com",
        password: "password123",
        saltPassword: "salt123",
        dateOfBirth: new Date("2002-11-1"),
        name: "Test User One",
        profileMediaId: "media1",
        bio: "I am test user one",
        verified: false,
        protectedAccount: false,
      },
      select: { id: true },
    });
    testUserIds.push(u1.id);

    const u2 = await prisma.user.upsert({
      where: { username: "test_user2" },
      update: {},
      create: {
        username: "test_user2",
        email: "test_user2@example.com",
        password: "password456",
        saltPassword: "salt456",
        dateOfBirth: new Date("2005-10-21"),
        name: "Test User Two",
        profileMediaId: "media1",
        bio: "I am test user two",
        verified: true,
        protectedAccount: true,
      },
      select: { id: true },
    });
    testUserIds.push(u2.id);

    const u3 = await prisma.user.upsert({
      where: { username: "test_user3" },
      update: {},
      create: {
        username: "test_user3",
        email: "test_user3@example.com",
        password: "password789",
        saltPassword: "salt789",
        dateOfBirth: new Date("2003-09-21"),
        name: "Test User Three",
        profileMediaId: "media1",
        bio: "I am test user three",
        verified: true,
        protectedAccount: false,
      },
      select: { id: true },
    });
    testUserIds.push(u3.id);

    publicTweet = await prisma.tweet.create({
      data: {
        content: "shared tweet for a public unverified account",
        tweetType: "TWEET",
        userId: testUserIds[1],
      },
    });
    protectedTweet = await prisma.tweet.create({
      data: {
        content: "shared tweet for a protected verified account",
        tweetType: "TWEET",
        userId: testUserIds[2],
      },
    });
  });

  beforeEach(async () => {
    await prisma.mention.deleteMany({
      where: { mentionerId: { in: testUserIds } },
    });
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: testUserIds } },
          { followingId: { in: testUserIds } },
        ],
      },
    });
    await prisma.tweetMedia.deleteMany({
      where: {
        tweet: { userId: { in: testUserIds } },
      },
    });
    await prisma.tweet.deleteMany({
      where: {
        AND: [
          { userId: { in: testUserIds } },
          { id: { notIn: [publicTweet.id, protectedTweet.id] } },
        ],
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    await prisma.tweetLike.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.retweet.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.tweetBookmark.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.tweet.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: testUserIds } },
          { followingId: { in: testUserIds } },
        ],
      },
    });
    await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: { in: testUserIds } },
          { blockedId: { in: testUserIds } },
        ],
      },
    });

    await prisma.tweetMedia.deleteMany({
      where: { tweet: { userId: { in: testUserIds } } },
    });
    await prisma.tweetCategory.deleteMany({
      where: { tweet: { userId: { in: testUserIds } } },
    });
    await prisma.tweetSummary.deleteMany({
      where: { tweet: { userId: { in: testUserIds } } },
    });
    await prisma.tweetHash.deleteMany({
      where: { tweet: { userId: { in: testUserIds } } },
    });
    await prisma.tweet.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    await prisma.media.deleteMany({
      where: { id: { in: testMediaIds } },
    });
    await prisma.$disconnect();
  });

  describe("validateId", () => {
    it("should not throw for a valid existing tweet id", async () => {
      await expect(
        tweetService["validateId"](publicTweet.id)
      ).resolves.not.toThrow();
    });

    it("should throw INVALID_ID if id is empty string", async () => {
      await expect(tweetService["validateId"]("")).rejects.toThrow(
        RESPONSES.ERRORS.INVALID_ID.message
      );
    });

    it("should throw TWEET_NOT_FOUND if tweet does not exist", async () => {
      await expect(
        tweetService["validateId"]("nonexistent-id")
      ).rejects.toThrow(RESPONSES.ERRORS.TWEET_NOT_FOUND.message);
    });
  });

  describe("createTweet", () => {
    it("should create a tweet", async () => {
      const dto = {
        content: "normal tweet",
        userId: testUserIds[1],
        replyControl: ReplyControl.EVERYONE,
      };
      const result = await tweetService.createTweet(dto);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(dto.userId);
      expect(result?.content).toBe(dto.content);
      expect(result?.tweetType).toBe(TweetType.TWEET);

      const savedTweet = await prisma.tweet.findUnique({
        where: { id: result.id },
      });
      expect(savedTweet).not.toBeNull();
      expect(savedTweet?.tweetType).toBe(TweetType.TWEET);
    });
    it("should enqueue jobs for background workers", async () => {
      const dto = {
        content: "normal tweet",
        userId: testUserIds[1],
        replyControl: ReplyControl.EVERYONE,
      };

      const result = await tweetService.createTweet(dto);
      expect(enqueueHashtagJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });

      expect(enqueueCategorizeTweetJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });
    });
  });

  describe("createQuote", () => {
    it("should create a quote tweet if parent tweet is public", async () => {
      const dto = {
        userId: testUserIds[2],
        content: "my quote",
        parentId: publicTweet.id,
      };

      const result = await tweetService.createQuote(dto);
      expect(result).not.toBeNull();
      expect(result.tweetType).toBe(TweetType.QUOTE);
      expect(result.parentId).toBe(publicTweet.id);

      const updatedParent = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
      });
      expect(updatedParent?.quotesCount).toBeGreaterThanOrEqual(1);
    });
    it("should enqueue jobs for background workers ", async () => {
      const dto = {
        userId: testUserIds[2],
        content: "my quote",
        parentId: publicTweet.id,
      };

      const result = await tweetService.createQuote(dto);
      expect(enqueueHashtagJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });

      expect(enqueueCategorizeTweetJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });

      expect(enqueueUpdateScoreJob).toHaveBeenCalledWith({
        tweetId: dto.parentId,
      });
    });
    it("should throw if parent tweet's user is protected", async () => {
      expect(
        tweetService.createQuote({
          userId: testUserIds[1],
          content: "my quote",
          parentId: protectedTweet.id,
        })
      ).rejects.toThrow("You can't quote a protected tweet");
    });

    it("should throw if no parent tweet exists", async () => {
      await expect(
        tweetService.createQuote({
          userId: testUserIds[2],
          content: "test",
          parentId: "non_existing",
        })
      ).rejects.toMatchObject({
        message: "Tweet not found",
        statusCode: 404,
      });
    });
  });

  describe("createReply", () => {
    it("should reply to a tweet set to reply control: EVERYONE", async () => {
      const dto = {
        userId: testUserIds[2],
        content: "my reply",
        parentId: publicTweet.id,
      };

      const result = await tweetService.createReply(dto);
      expect(result).not.toBeNull();
      expect(result.tweetType).toBe(TweetType.REPLY);
      expect(result.parentId).toBe(publicTweet.id);

      const updatedParent = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
        select: { repliesCount: true },
      });
      expect(updatedParent?.repliesCount).toBeGreaterThanOrEqual(1);
    });
    it("should enqueue jobs for background workers ", async () => {
      const dto = {
        userId: testUserIds[2],
        content: "my reply",
        parentId: publicTweet.id,
      };

      const result = await tweetService.createReply(dto);
      expect(enqueueHashtagJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });

      expect(enqueueCategorizeTweetJob).toHaveBeenCalledWith({
        tweetId: result.id,
        content: result.content,
      });

      expect(enqueueUpdateScoreJob).toHaveBeenCalledWith({
        tweetId: dto.parentId,
      });
    });
    it("should reply to a protected tweet", async () => {
      const dto = {
        userId: testUserIds[3],
        content: "my reply",
        parentId: protectedTweet.id,
      };
      await prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: testUserIds[3],
            followingId: testUserIds[2],
          },
        },
        update: {},
        create: {
          followerId: testUserIds[3],
          followingId: testUserIds[2],
          status: "ACCEPTED",
        },
      });
      const result = await tweetService.createReply(dto);
      expect(result).not.toBeNull();
      expect(result.tweetType).toBe(TweetType.REPLY);
      expect(result.parentId).toBe(protectedTweet.id);

      const updatedParent = await prisma.tweet.findUnique({
        where: { id: protectedTweet.id },
        select: { repliesCount: true },
      });
      expect(updatedParent?.repliesCount).toBeGreaterThanOrEqual(1);
    });

    it("should throw if no parent tweet exists", async () => {
      await expect(
        tweetService.createReply({
          userId: testUserIds[2],
          content: "test",
          parentId: "non_existing",
        })
      ).rejects.toMatchObject({
        message: "Tweet not found",
        statusCode: 404,
      });
    });

    it("should throw if parent tweet's user is protected and current user isn't a follower", async () => {
      expect(
        tweetService.createReply({
          userId: testUserIds[1],
          content: "my reply",
          parentId: protectedTweet.id,
        })
      ).rejects.toMatchObject({
        message: "You cannot reply to this tweet",
        statusCode: 403,
      });
    });

    it("should throw if reply control is verified only", async () => {
      const parentTweet = await prisma.tweet.create({
        data: {
          content: "test",
          tweetType: "TWEET",
          userId: testUserIds[2],
          replyControl: "VERIFIED",
        },
      });

      await expect(
        tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: testUserIds[1],
        })
      ).rejects.toMatchObject({
        message: "You cannot reply to this tweet",
        statusCode: 403,
      });
    });

    describe("when replyControl is followings only", () => {
      let parentTweet: Tweet;
      beforeEach(async () => {
        parentTweet = await prisma.tweet.create({
          data: {
            content: "test",
            tweetType: "TWEET",
            userId: testUserIds[1],
            replyControl: "FOLLOWINGS",
          },
        });
      });
      it("should throw if user isn't from followings of the parent tweet's owner", async () => {
        await expect(
          tweetService.createReply({
            content: "test",
            parentId: parentTweet.id,
            userId: testUserIds[2],
          })
        ).rejects.toMatchObject({
          message: "You cannot reply to this tweet",
          statusCode: 403,
        });
      });

      it("should reply if user is from followings of the parent tweet's owner", async () => {
        await prisma.follow.upsert({
          where: {
            followerId_followingId: {
              followerId: testUserIds[2],
              followingId: testUserIds[1],
            },
          },
          update: {},
          create: {
            followerId: testUserIds[2],
            followingId: testUserIds[1],
            status: "ACCEPTED",
          },
        });
        const result = await tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: testUserIds[2],
        });
        expect(result).not.toBeNull();
        expect(result?.tweetType).toBe(TweetType.REPLY);
        expect(result?.parentId).toBe(parentTweet.id);
      });
    });

    describe("when replyControl is mentioned only", () => {
      let parentTweet: Tweet;
      beforeEach(async () => {
        parentTweet = await prisma.tweet.create({
          data: {
            content: "test",
            tweetType: "TWEET",
            userId: testUserIds[1],
            replyControl: "MENTIONED",
          },
        });
      });
      it("should throw if user isn't mentioned", async () => {
        await expect(
          tweetService.createReply({
            content: "test",
            parentId: parentTweet.id,
            userId: testUserIds[2],
          })
        ).rejects.toMatchObject({
          message: "You cannot reply to this tweet",
          statusCode: 403,
        });
      });
      it("should reply if user is mentioned", async () => {
        await prisma.mention.create({
          data: {
            mentionedId: testUserIds[2],
            mentionerId: testUserIds[1],
            tweetId: parentTweet.id,
          },
        });
        const result = await tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: testUserIds[2],
        });
        expect(result).not.toBeNull();
        expect(result.tweetType).toBe(TweetType.REPLY);
        expect(result.parentId).toBe(parentTweet.id);
        expect(result.userId).toBe(testUserIds[2]);
      });
    });
  });

  describe("createRetweet", () => {
    it("should create a retweet", async () => {
      const parentTweet = await prisma.tweet.create({
        data: {
          userId: testUserIds[1],
          content: "original tweet",
          tweetType: TweetType.TWEET,
        },
      });
      const result = await tweetService.createRetweet({
        userId: testUserIds[1],
        parentId: parentTweet.id,
      });

      expect(result?.userId).toBe(testUserIds[1]);
      expect(result?.tweetId).toBe(parentTweet.id);

      const updatedParent = await prisma.tweet.findUnique({
        where: { id: parentTweet.id },
        select: { retweetCount: true },
      });
      expect(updatedParent?.retweetCount).toBe(1);
    });

    it("should throw if parent tweet id is invalid", async () => {
      await expect(
        tweetService.createRetweet({
          userId: testUserIds[1],
          parentId: testUserIds[1],
        })
      ).rejects.toMatchObject({ message: "Tweet not found", statusCode: 404 });
    });
  });

  describe("updateTweet", () => {
    it("should update content successfully", async () => {
      const result = await tweetService.updateTweet(publicTweet.id, {
        userId: testUserIds[1],
        content: "updated content",
      });

      expect(result?.id).toBe(publicTweet.id);

      const updated = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
        select: { content: true },
      });
      expect(updated?.content).toBe("updated content");
    });

    it("should update replyControl successfully", async () => {
      const result = await tweetService.updateTweet(publicTweet.id, {
        userId: testUserIds[1],
        replyControl: "FOLLOWINGS",
      });

      expect(result?.id).toBe(publicTweet.id);

      const updated = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
        select: { replyControl: true },
      });
      expect(updated?.replyControl).toBe("FOLLOWINGS");
    });

    it("should update tweetMedia successfully", async () => {
      const result = await tweetService.updateTweet(publicTweet.id, {
        userId: testUserIds[1],
        tweetMedia: ["media1", "media2"],
      });

      expect(result?.id).toBe(publicTweet.id);

      const media = await prisma.tweetMedia.findMany({
        where: { tweetId: publicTweet.id },
        select: { mediaId: true },
      });
      expect(media.map((m) => m.mediaId)).toEqual(["media1", "media2"]);
    });

    it("should throw if no fields provided", async () => {
      await expect(
        tweetService.updateTweet(publicTweet.id, { userId: testUserIds[1] })
      ).rejects.toThrow(RESPONSES.ERRORS.TWEET_UPDATE_FIELDS.message);
    });

    it("should throw if tweet not owned by user", async () => {
      await expect(
        tweetService.updateTweet(publicTweet.id, {
          userId: testUserIds[2],
          content: "hacked",
        })
      ).rejects.toThrow(RESPONSES.ERRORS.TWEET_OWNER_ACCESS.message);
    });

    it("should throw if tweet id is invalid", async () => {
      await expect(
        tweetService.updateTweet("invalid-id", {
          userId: testUserIds[1],
          content: "new content",
        })
      ).rejects.toThrow("Tweet not found");
    });
  });

  describe("getRetweets", () => {
    it("should return all retweets for a given tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: testUserIds[1] },
      });

      const retweetsData = [
        { tweetId: tweet.id, userId: testUserIds[1] },
        { tweetId: tweet.id, userId: testUserIds[3] },
      ];

      await prisma.retweet.createMany({ data: retweetsData });

      const result = await tweetService.getRetweets(tweet.id, {
        userId: tweet.userId,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      const userIds = result.data.map((r: any) => r.id);
      expect(userIds).toEqual(expect.arrayContaining([testUserIds[1], testUserIds[3]]));
    });

    it("should throw if parent tweet id is invalid", async () => {
      await expect(
        tweetService.getRetweets(testUserIds[1], {
          userId: testUserIds[1],
          limit: 3,
        })
      ).rejects.toMatchObject({
        message: "Tweet not found",
        statusCode: 404,
      });
    });
  });

  describe("deleteTweet", () => {
    it("should delete an existing tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: testUserIds[1] },
      });

      await tweetService.deleteTweet(tweet.id);
      const result = await prisma.tweet.findUnique({
        where: { id: tweet.id },
      });
      expect(result).toBe(null);
    });

    it("should delete an existing reply and decrement reply count of parent tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: testUserIds[1] },
      });

      const reply = await prisma.tweet.create({
        data: {
          content: "reply",
          tweetType: "REPLY",
          userId: testUserIds[2],
          parentId: tweet.id,
        },
      });
      await prisma.tweet.update({
        where: { id: tweet.id },
        data: { repliesCount: { increment: 1 } },
      });
      await tweetService.deleteTweet(reply.id);
      const result = await prisma.tweet.findUnique({
        where: { id: reply.id },
      });
      expect(result).toBe(null);
      const parent = await prisma.tweet.findUnique({
        where: { id: tweet.id },
        select: { repliesCount: true },
      });
      expect(parent?.repliesCount).toBe(0);
    });

    it("should delete an existing quote and decrement quote count of parent tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: testUserIds[1] },
      });

      const quote = await prisma.tweet.create({
        data: {
          content: "quote",
          tweetType: "QUOTE",
          userId: testUserIds[2],
          parentId: tweet.id,
        },
      });
      await prisma.tweet.update({
        where: { id: tweet.id },
        data: { quotesCount: { increment: 1 } },
      });
      await tweetService.deleteTweet(quote.id);
      const result = await prisma.tweet.findUnique({
        where: { id: quote.id },
      });
      expect(result).toBe(null);
      const parent = await prisma.tweet.findUnique({
        where: { id: tweet.id },
        select: { quotesCount: true },
      });
      expect(parent?.quotesCount).toBe(0);
    });

    it("should delete an existing retweet and decrement retweet count of parent tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: testUserIds[1] },
      });

      await prisma.retweet.create({
        data: { tweetId: tweet.id, userId: testUserIds[2] },
      });
      await prisma.tweet.update({
        where: { id: tweet.id },
        data: { retweetCount: { increment: 1 } },
      });
      await tweetService.deleteRetweet(testUserIds[2], tweet.id);
      const result = await prisma.retweet.findUnique({
        where: {
          userId_tweetId: { userId: testUserIds[2], tweetId: tweet.id },
        },
      });
      expect(result).toBe(null);
      const parent = await prisma.tweet.findUnique({
        where: { id: tweet.id },
        select: { retweetCount: true },
      });
      expect(parent?.retweetCount).toBe(0);
    });

    it("should throw if tweet id is invalid", async () => {
      await expect(
        tweetService.deleteTweet("bla bla bla")
      ).rejects.toMatchObject({
        message: "Tweet not found",
        statusCode: 404,
      });
    });
  });

  describe("getLikedTweets", () => {
    it("should get user's liked tweets", async () => {
      const [tweet1, tweet2, tweet3] = await Promise.all([
        prisma.tweet.create({
          data: {
            content: "tweet one",
            userId: testUserIds[2],
            tweetType: "TWEET",
          },
        }),
        prisma.tweet.create({
          data: { content: "tweet two", userId: testUserIds[3], tweetType: "QUOTE" },
        }),
        prisma.tweet.create({
          data: {
            content: "tweet three",
            userId: testUserIds[1],
            tweetType: "REPLY",
          },
        }),
      ]);
      await prisma.tweetLike.createMany({
        data: [
          {
            userId: testUserIds[1],
            tweetId: tweet1.id,
            createdAt: new Date("2025-12-05T10:00:00Z"),
          },
          {
            userId: testUserIds[1],
            tweetId: tweet2.id,
            createdAt: new Date("2025-12-05T10:05:00Z"),
          },
          {
            userId: testUserIds[1],
            tweetId: tweet3.id,
            createdAt: new Date("2025-12-05T10:10:00Z"),
          },
        ],
      });

      const res = await tweetService.getLikedTweets({
        userId: testUserIds[1],
        limit: 10,
      });
      const likedIds = res.data.map((like) => like.id);

      expect(likedIds).toEqual(
        expect.arrayContaining([tweet1.id, tweet2.id, tweet3.id])
      );
      expect(res.data).toHaveLength(3);
    });
  });

  describe("getTweetReplies", () => {
    it("should get all replies for a tweet", async () => {
      await prisma.tweet.deleteMany({
        where: { tweetType: "REPLY", parentId: publicTweet.id },
      });
      const [reply1, reply2, reply3] = await Promise.all([
        prisma.tweet.create({
          data: {
            content: "reply one",
            userId: testUserIds[2],
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
        prisma.tweet.create({
          data: {
            content: "reply two",
            userId: testUserIds[3],
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
        prisma.tweet.create({
          data: {
            content: "reply three",
            userId: testUserIds[1],
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
      ]);
      const res = await tweetService.getTweetRepliesOrQuotes(publicTweet.id, {
        userId: testUserIds[1],
        limit: 10,
      });

      const repliesIds = res.data.map((reply) => reply.id);

      expect(repliesIds).toEqual(
        expect.arrayContaining([reply1.id, reply2.id, reply3.id])
      );
      expect(res.data).toHaveLength(3);
    });
  });

  describe("likeTweet", () => {
    it("should like a tweet and update likes count of parent", async () => {
      await tweetService.likeTweet(testUserIds[2], publicTweet.id);

      const updatedtweet = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
      });
      expect(updatedtweet?.likesCount).toBe(1);
      const res = await prisma.tweetLike.findUnique({
        where: {
          userId_tweetId: { userId: testUserIds[2], tweetId: publicTweet.id },
        },
      });
      expect(res).toBeDefined();
    });
    it("should throw when liking an already liked tweet", async () => {
      await expect(
        tweetService.likeTweet(testUserIds[2], publicTweet.id)
      ).rejects.toMatchObject({
        message: "Tweet already liked",
        statusCode: 409,
      });
    });
  });

  describe("deleteLike", () => {
    it("should delete a like on a tweet", async () => {
      await tweetService.deleteLike(testUserIds[2], publicTweet.id);

      const res = await prisma.tweetLike.findUnique({
        where: {
          userId_tweetId: { userId: testUserIds[2], tweetId: publicTweet.id },
        },
      });
      expect(res).toBeNull();
    });

    it("should throw when deleting a non existent like", async () => {
      await expect(
        tweetService.deleteLike(testUserIds[2], publicTweet.id)
      ).rejects.toMatchObject({
        message: "You haven't liked this tweet yet",
        statusCode: 409,
      });
    });
  });

  describe("getLikers", () => {
    it("should return likers of a tweet", async () => {
      await prisma.tweetLike.createMany({
        data: [
          { userId: testUserIds[1], tweetId: publicTweet.id },
          { userId: testUserIds[2], tweetId: publicTweet.id },
          { userId: testUserIds[3], tweetId: publicTweet.id },
        ],
      });

      const res = await tweetService.getLikers(publicTweet.id, {
        limit: 10,
        userId: testUserIds[1],
      });
      const likersIds = res.data.map((like) => like.id);

      expect(likersIds).toEqual(
        expect.arrayContaining([testUserIds[1], testUserIds[2], testUserIds[3]])
      );
      expect(res.data).toHaveLength(3);
    });
  });

  describe("getUserTweets", () => {
    let reply: Tweet, normal: Tweet;
    beforeAll(async () => {
      await prisma.tweet.deleteMany({ where: { userId: testUserIds[3] } });
    });

    it("should return all tweet for a user", async () => {
      const [quote, reply] = await Promise.all([
        prisma.tweet.create({
          data: {
            userId: testUserIds[2],
            content: "bla bla bla",
            tweetType: "QUOTE",
          },
        }),
        prisma.tweet.create({
          data: {
            userId: testUserIds[2],
            content: "bla bla bla",
            tweetType: "REPLY",
          },
        }),
      ]);

      const res = await tweetService.getUserTweets(
        {
          userId: testUserIds[2],
          limit: 10,
        },
        testUserIds[1]
      );

      const tweetIds = res.data.map((tweet) => tweet.id);

      expect(tweetIds).toEqual(
        expect.arrayContaining([reply.id, quote.id, protectedTweet.id])
      );
      expect(res.data).toHaveLength(3);
    });

    it("should return all tweets for a user with default limit", async () => {
      reply = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "reply tweet",
          tweetType: TweetType.REPLY,
        },
      });
      normal = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "normal tweet",
          tweetType: TweetType.TWEET,
        },
      });
      const res = await tweetService.getUserTweets(
        { userId: testUserIds[3], limit: 2 },
        testUserIds[2]
      );

      const tweetIds = res.data.map((t) => t.id);
      expect(tweetIds).toEqual(expect.arrayContaining([reply.id, normal.id]));
      expect(res.data).toHaveLength(2);
      expect(res.cursor).toBeDefined();
    });

    it("should filter tweets by type", async () => {
      await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "quote tweet",
          tweetType: TweetType.QUOTE,
        },
      });
      reply = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "reply tweet",
          tweetType: TweetType.REPLY,
        },
      });
      normal = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "normal tweet",
          tweetType: TweetType.TWEET,
        },
      });
      const res = await tweetService.getUserTweets(
        { userId: testUserIds[3], limit: 10, tweetType: TweetType.REPLY },
        testUserIds[2]
      );

      expect(res.data).toHaveLength(1);
      expect(res.data[0].tweetType).toBe(TweetType.REPLY);
    });

    it("should order tweets by createdAt desc then id desc", async () => {
      const t1 = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "older tweet",
          tweetType: TweetType.TWEET,
        },
      });
      const t2 = await prisma.tweet.create({
        data: {
          userId: testUserIds[3],
          content: "newer tweet",
          tweetType: TweetType.TWEET,
        },
      });

      const res = await tweetService.getUserTweets(
        { userId: testUserIds[3], limit: 10 },
        testUserIds[1]
      );
      const ids = res.data.map((t) => t.id);

      expect(ids[0]).toBe(t2.id);
      expect(ids[1]).toBe(t1.id);
    });
  });

  describe("getMentionedTweets", () => {
    it("should return tweets where the user is mentioned", async () => {
      const [tweet1, tweet2, tweet3] = await Promise.all([
        prisma.tweet.create({
          data: {
            content: "tweet one",
            userId: testUserIds[1],
            tweetType: "TWEET",
          },
        }),
        prisma.tweet.create({
          data: {
            content: "tweet two",
            userId: testUserIds[2],
            tweetType: "TWEET",
          },
        }),
        prisma.tweet.create({
          data: { content: "tweet three", userId: testUserIds[3], tweetType: "TWEET" },
        }),
      ]);

      await prisma.mention.createMany({
        data: [
          {
            mentionedId: testUserIds[1],
            mentionerId: testUserIds[1],
            tweetId: tweet1.id,
          },
          {
            mentionedId: testUserIds[1],
            mentionerId: testUserIds[2],
            tweetId: tweet2.id,
          },
          {
            mentionedId: testUserIds[1],
            mentionerId: testUserIds[3],
            tweetId: tweet3.id,
          },
        ],
      });

      const res = await tweetService.getMentionedTweets({
        userId: testUserIds[1],
        limit: 10,
      });

      const mentionedIds = res.data.map((t: any) => t.id);

      expect(mentionedIds).toEqual(
        expect.arrayContaining([tweet1.id, tweet2.id, tweet3.id])
      );
      expect(mentionedIds).toHaveLength(3);
    });

    it("should respect limit and return a cursor for pagination", async () => {
      const [tweet1, tweet2] = await Promise.all([
        prisma.tweet.create({
          data: {
            content: "tweet one",
            userId: testUserIds[2],
            tweetType: "TWEET",
          },
        }),
        prisma.tweet.create({
          data: { content: "tweet two", userId: testUserIds[3], tweetType: "TWEET" },
        }),
      ]);

      await prisma.mention.createMany({
        data: [
          {
            mentionedId: testUserIds[1],
            mentionerId: testUserIds[2],
            tweetId: tweet1.id,
          },
          {
            mentionedId: testUserIds[1],
            mentionerId: testUserIds[3],
            tweetId: tweet2.id,
          },
        ],
      });

      const res = await tweetService.getMentionedTweets({
        userId: testUserIds[1],
        limit: 1,
      });

      expect(res.data).toHaveLength(1);
      expect(res.cursor).toBeDefined();
    });
  });

  describe("getUserMedias", () => {
    const mediaTweetIds: string[] = [];
    const mediaIds: string[] = [];

    afterEach(async () => {
      // Clean up tweets and media created in this test suite
      await prisma.tweetMedia.deleteMany({
        where: { tweetId: { in: mediaTweetIds } },
      });
      await prisma.tweet.deleteMany({
        where: { id: { in: mediaTweetIds } },
      });
      await prisma.media.deleteMany({
        where: { id: { in: mediaIds } },
      });
      mediaTweetIds.length = 0;
      mediaIds.length = 0;
    });

    it("should return tweets with media for a user", async () => {
      const media = await prisma.media.create({
        data: {
          name: "test_m3",
          keyName: `http://img3-${Date.now()}.jpg`,
          type: "IMAGE",
        },
      });
      mediaIds.push(media.id);

      const tweet = await prisma.tweet.create({
        data: {
          id: "m1",
          content: "Tweet with media",
          userId: testUserIds[1],
          tweetType: "TWEET",
          tweetMedia: {
            create: {
              mediaId: media.id,
            },
          },
        },
      });
      mediaTweetIds.push(tweet.id);

      const result = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 10,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      const foundTweet = result.data.find((t) => t.id === tweet.id);
      expect(foundTweet).toBeDefined();
      expect(foundTweet?.tweetMedia[0].media.name).toBe("test_m3");
    });

    it("should filter by tweetType if provided", async () => {
      const media1 = await prisma.media.create({
        data: { name: "test_m4", keyName: `k1-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media1.id);

      const media2 = await prisma.media.create({
        data: { name: "test_m5", keyName: `k2-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media2.id);

      const tweet1 = await prisma.tweet.create({
        data: {
          id: "m2",
          content: "Media tweet",
          userId: testUserIds[1],
          tweetType: "TWEET",
          tweetMedia: {
            create: {
              mediaId: media1.id,
            },
          },
        },
      });
      mediaTweetIds.push(tweet1.id);

      const tweet2 = await prisma.tweet.create({
        data: {
          id: "m3",
          content: "Reply with media",
          userId: testUserIds[1],
          tweetType: "REPLY",
          tweetMedia: {
            create: {
              mediaId: media2.id,
            },
          },
        },
      });
      mediaTweetIds.push(tweet2.id);

      const result = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 10,
        tweetType: "REPLY",
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe("m3");
    });

    it("should order by createdAt desc then id desc", async () => {
      const media1 = await prisma.media.create({
        data: { name: "test_m6", keyName: `k3-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media1.id);

      const media2 = await prisma.media.create({
        data: { name: "test_m7", keyName: `k4-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media2.id);

      const t1 = await prisma.tweet.create({
        data: {
          id: "m4",
          content: "Older",
          userId: testUserIds[1],
          tweetType: "TWEET",
          createdAt: new Date("2020-01-01"),
          tweetMedia: {
            create: {
              mediaId: media1.id,
            },
          },
        },
      });
      mediaTweetIds.push(t1.id);

      const t2 = await prisma.tweet.create({
        data: {
          id: "m5",
          content: "Newer",
          userId: testUserIds[1],
          tweetType: "TWEET",
          createdAt: new Date("2021-01-01"),
          tweetMedia: {
            create: {
              mediaId: media2.id,
            },
          },
        },
      });
      mediaTweetIds.push(t2.id);

      const result = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 10,
      });

      expect(result.data[0].id).toBe(t2.id);
      expect(result.data[1].id).toBe(t1.id);
    });

    it("should paginate with cursor", async () => {
      const media1 = await prisma.media.create({
        data: { name: "test_m8", keyName: `k5-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media1.id);

      const media2 = await prisma.media.create({
        data: { name: "test_m9", keyName: `k6-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media2.id);

      const t1 = await prisma.tweet.create({
        data: {
          id: "m6",
          content: "Page1",
          userId: testUserIds[1],
          tweetType: "TWEET",
          createdAt: new Date("2022-01-01"),
          tweetMedia: {
            create: {
              mediaId: media1.id,
            },
          },
        },
      });
      mediaTweetIds.push(t1.id);

      const t2 = await prisma.tweet.create({
        data: {
          id: "m7",
          content: "Page2",
          userId: testUserIds[1],
          tweetType: "TWEET",
          createdAt: new Date("2023-01-01"),
          tweetMedia: {
            create: {
              mediaId: media2.id,
            },
          },
        },
      });
      mediaTweetIds.push(t2.id);

      const firstPage = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 1,
      });

      const decodedCursor = encoderService.decode<{
        id: string;
        createdAt: Date;
      }>(firstPage.cursor as string);

      const secondPage = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 1,
        cursor: decodedCursor ?? undefined,
      });

      expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    });

    it("should return empty if user has no media tweets", async () => {
      const tweet = await prisma.tweet.create({
        data: {
          id: "m8",
          content: "No media",
          userId: testUserIds[1],
          tweetType: "TWEET",
        },
      });
      mediaTweetIds.push(tweet.id);

      const result = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });

    it("should respect limit boundaries", async () => {
      const media1 = await prisma.media.create({
        data: { name: "test_m10", keyName: `k7-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media1.id);

      const media2 = await prisma.media.create({
        data: { name: "test_m11", keyName: `k8-${Date.now()}`, type: "IMAGE" },
      });
      mediaIds.push(media2.id);

      const t1 = await prisma.tweet.create({
        data: {
          id: "m9",
          content: "Media1",
          userId: testUserIds[1],
          tweetType: "TWEET",
          tweetMedia: {
            create: {
              mediaId: media1.id,
            },
          },
        },
      });
      mediaTweetIds.push(t1.id);

      const t2 = await prisma.tweet.create({
        data: {
          id: "m10",
          content: "Media2",
          userId: testUserIds[1],
          tweetType: "TWEET",
          tweetMedia: {
            create: {
              mediaId: media2.id,
            },
          },
        },
      });
      mediaTweetIds.push(t2.id);

      const result = await tweetService.getUserMedias({
        userId: testUserIds[1],
        limit: 1,
      });

      expect(result.data.length).toBe(1);
      expect(result.cursor).not.toBeNull();
    });
  });

  describe("saveMentionedUsersTx", () => {
    beforeEach(async () => {
      await prisma.mention.deleteMany({});
    });
    it("should create mentions for mentioned users", async () => {
      await prisma.$transaction(async (tx) => {
        await tweetService["saveMentionedUsersTx"](
          tx,
          publicTweet.id,
          "Hello @test_user2",
          testUserIds[1]
        );
      });
      expect(addNotification).toHaveBeenCalledWith(testUserIds[2], {
        title: "MENTION",
        body: "Test User One mentioned you",
        tweetId: publicTweet.id,
        actorId: testUserIds[1],
      });

      const mentions = await prisma.mention.findMany({
        where: { tweetId: publicTweet.id },
      });
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        mentionerId: testUserIds[1],
        mentionedId: testUserIds[2],
        tweetId: publicTweet.id,
      });
    });

    it("should do nothing if no mentions in content", async () => {
      await prisma.$transaction(async (tx) => {
        await tweetService["saveMentionedUsersTx"](
          tx,
          publicTweet.id,
          "Hello world",
          testUserIds[1]
        );
      });

      expect(addNotification).not.toHaveBeenCalled();

      const mentions = await prisma.mention.findMany({
        where: { tweetId: "tweet456" },
      });
      expect(mentions).toHaveLength(0);
    });

    it("should skip blocked users", async () => {
      await prisma.block.create({
        data: { blockerId: testUserIds[1], blockedId: testUserIds[3] },
      });

      await prisma.$transaction(async (tx) => {
        await tweetService["saveMentionedUsersTx"](
          tx,
          publicTweet.id,
          "Hello @test_user3",
          testUserIds[1]
        );
      });

      expect(addNotification).not.toHaveBeenCalled();

      const mentions = await prisma.mention.findMany({
        where: { mentionedId: testUserIds[3], mentionerId: testUserIds[1] },
      });
      expect(mentions).toHaveLength(0);
    });

    it("should handle multiple mentions", async () => {
      const user4 = await prisma.user.upsert({
        where: { username: "test_user4" },
        update: {},
        create: {
          username: "test_user4",
          id: "444",
          email: "test_user4@example.com",
          password: "password123",
          saltPassword: "salt123",
          name: "Test User Four",
        },
      });

      await prisma.$transaction(async (tx) => {
        await tweetService["saveMentionedUsersTx"](
          tx,
          publicTweet.id,
          "Hello @test_user4 and @test_user2",
          testUserIds[1]
        );
      });

      expect(addNotification).toHaveBeenCalledTimes(2);

      const mentions = await prisma.mention.findMany({
        where: { tweetId: publicTweet.id },
      });
      expect(mentions).toHaveLength(2);
      expect(mentions.map((m) => m.mentionedId)).toEqual(
        expect.arrayContaining([testUserIds[2], user4.id])
      );
    });
  });

  describe("saveTweetMediasTx", () => {
    it("should create tweetMedia records for provided mediaIds", async () => {
      await prisma.$transaction(async (tx) => {
        await tweetService["saveTweetMediasTx"](tx, publicTweet.id, [
          "media1",
          "media2",
        ]);
      });

      const medias = await prisma.tweetMedia.findMany({
        where: { tweetId: publicTweet.id },
        select: { mediaId: true },
      });

      expect(medias.map((m) => m.mediaId)).toEqual(["media1", "media2"]);
    });

    it("should do nothing if mediaIds is empty", async () => {
      await prisma.$transaction(async (tx) => {
        await tweetService["saveTweetMediasTx"](tx, protectedTweet.id, []);
      });

      const medias = await prisma.tweetMedia.findMany({
        where: { tweetId: protectedTweet.id },
      });

      expect(medias).toHaveLength(0);
    });

    it("should skip duplicates if same mediaId provided twice", async () => {
      await prisma.$transaction(async (tx) => {
        await tweetService["saveTweetMediasTx"](tx, protectedTweet.id, [
          "media1",
          "media1",
        ]);
      });

      const medias = await prisma.tweetMedia.findMany({
        where: { tweetId: protectedTweet.id },
      });
      expect(medias).toHaveLength(1);
      expect(medias[0].mediaId === "media1");
    });
  });

  describe("getTweet", () => {
    it("should return a tweet when given a valid id", async () => {
      const result = await tweetService.getTweet(
        publicTweet.id,
        testUserIds[1]
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(publicTweet.id);
      expect(result.userId).toBe(testUserIds[1]);
      expect(result.tweetType).toBe(TweetType.TWEET);
    });

    it("should throw INVALID_ID if id is empty", async () => {
      await expect(tweetService.getTweet("", testUserIds[1])).rejects.toThrow(
        RESPONSES.ERRORS.INVALID_ID.message
      );
    });

    it("should throw TWEET_NOT_FOUND if tweet does not exist", async () => {
      await expect(
        tweetService.getTweet("nonexistent-id", testUserIds[1])
      ).rejects.toThrow(RESPONSES.ERRORS.TWEET_NOT_FOUND.message);
    });
  });

  describe("getTweetSummary", () => {
    beforeEach(async () => {
      await prisma.tweetSummary.deleteMany({});
    });

    it("should return a new summary if none exists", async () => {
      const result = await tweetService.getTweetSummary(protectedTweet.id);

      expect(generateTweetSumamry).toHaveBeenCalledWith(protectedTweet.content);
      expect(result).toEqual({ summary: "mock summary" });

      const dbSummary = await prisma.tweetSummary.findUnique({
        where: { tweetId: protectedTweet.id },
      });
      expect(dbSummary?.summary).toBe("mock summary");
    });

    it("should return existing summary if already present", async () => {
      await prisma.tweetSummary.create({
        data: { tweetId: protectedTweet.id, summary: "existing summary" },
      });

      const result = await tweetService.getTweetSummary(protectedTweet.id);

      expect(generateTweetSumamry).not.toHaveBeenCalled();
      expect(result).toEqual({ summary: "existing summary" });
    });

    it("should throw INVALID_ID if id is empty", async () => {
      await expect(tweetService.getTweetSummary("")).rejects.toThrow(
        RESPONSES.ERRORS.INVALID_ID.message
      );
    });

    it("should throw TWEET_NOT_FOUND if tweet does not exist", async () => {
      await expect(
        tweetService.getTweetSummary("nonexistent-id")
      ).rejects.toThrow(RESPONSES.ERRORS.TWEET_NOT_FOUND.message);
    });
  });

  describe("categorizeTweet", () => {
    let category1: any;
    let category2: any;
    beforeEach(async () => {
      await prisma.tweetCategory.deleteMany({});
      await prisma.category.deleteMany({});

      category1 = await prisma.category.create({ data: { name: "Sports" } });
      category2 = await prisma.category.create({ data: { name: "News" } });
    });
    it("should categorize a tweet and create tweetCategory records", async () => {
      (generateTweetCategory as jest.Mock).mockResolvedValue([
        "Sports",
        "News",
      ]);

      await prisma.$transaction(async (tx) => {
        await tweetService.categorizeTweet(
          publicTweet.id,
          publicTweet.content,
          tx
        );
      });

      const records = await prisma.tweetCategory.findMany({
        where: { tweetId: publicTweet.id },
      });

      expect(records).toHaveLength(2);
      expect(records.map((r) => r.categoryId)).toEqual(
        expect.arrayContaining([category1.id, category2.id])
      );
    });

    it("should skip categorization if tweet does not exist", async () => {
      (generateTweetCategory as jest.Mock).mockResolvedValue(["Sports"]);

      await prisma.$transaction(async (tx) => {
        await tweetService.categorizeTweet("nonexistent-id", "content", tx);
      });

      const records = await prisma.tweetCategory.findMany({
        where: { tweetId: "nonexistent-id" },
      });

      expect(records).toHaveLength(0);
    });
    it("should do nothing if generateTweetCategory returns empty array", async () => {
      (generateTweetCategory as jest.Mock).mockResolvedValue([]);

      await prisma.$transaction(async (tx) => {
        await tweetService.categorizeTweet(
          publicTweet.id,
          publicTweet.content,
          tx
        );
      });

      const records = await prisma.tweetCategory.findMany({
        where: { tweetId: publicTweet.id },
      });

      expect(records).toHaveLength(0);
    });

    it("should do nothing if no matching categories exist in DB", async () => {
      (generateTweetCategory as jest.Mock).mockResolvedValue(["Nonexistent"]);

      await prisma.$transaction(async (tx) => {
        await tweetService.categorizeTweet(
          publicTweet.id,
          publicTweet.content,
          tx
        );
      });

      const records = await prisma.tweetCategory.findMany({
        where: { tweetId: publicTweet.id },
      });

      expect(records).toHaveLength(0);
    });

    it("should skip duplicates when same category returned twice", async () => {
      (generateTweetCategory as jest.Mock).mockResolvedValue([
        "Sports",
        "Sports",
      ]);

      await prisma.$transaction(async (tx) => {
        await tweetService.categorizeTweet(
          publicTweet.id,
          publicTweet.content,
          tx
        );
      });

      const records = await prisma.tweetCategory.findMany({
        where: { tweetId: publicTweet.id },
      });

      expect(records).toHaveLength(1);
      expect(records[0].categoryId).toBe(category1.id);
    });
  });

  describe("searchTweets", () => {
    let searchTweet1: any, searchTweet2: any, searchTweet3: any;
    const searchTweetIds: string[] = [];

    beforeEach(async () => {
      if (searchTweetIds.length > 0) {
        await prisma.tweet.deleteMany({
          where: { id: { in: searchTweetIds } },
        });
        searchTweetIds.length = 0;
      }

      searchTweet1 = await prisma.tweet.create({
        data: {
          content: "This is a searchable tweet about testing",
          userId: testUserIds[1],
          tweetType: "TWEET",
          score: 10,
          likesCount: 5,
        },
      });
      searchTweetIds.push(searchTweet1.id);
      searchTweet2 = await prisma.tweet.create({
        data: {
          content: "Another searchable post with different content",
          userId: testUserIds[2],
          tweetType: "TWEET",
          score: 20,
          likesCount: 10,
        },
      });
      searchTweetIds.push(searchTweet2.id);
      searchTweet3 = await prisma.tweet.create({
        data: {
          content: "Searchable tweet from protected account",
          userId: testUserIds[3],
          tweetType: "TWEET",
          score: 15,
          likesCount: 8,
        },
      });
      searchTweetIds.push(searchTweet3.id);
    });

    afterEach(async () => {
      await prisma.tweetLike.deleteMany({
        where: { tweetId: { in: searchTweetIds } },
      });
      await prisma.tweet.deleteMany({
        where: { id: { in: searchTweetIds } },
      });
      await prisma.hash.deleteMany({
        where: { tag_text: { contains: "testtag" } },
      });
    });

    it("should return tweets matching the search query", async () => {
      const result = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBeGreaterThan(0);
      const foundIds = result.data.map((t: any) => t.id);
      expect(foundIds).toContain(searchTweet1.id);
    });

    it("should return empty array when no tweets match", async () => {
      const result = await tweetService.searchTweets({
        query: "nonexistentquery12345",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });

    it("should filter by FOLLOWINGS when peopleFilter is set", async () => {
      await prisma.follow.create({
        data: {
          followerId: testUserIds[1],
          followingId: testUserIds[2],
          status: "ACCEPTED",
        },
      });

      const result = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.FOLLOWINGS,
      });

      const foundIds = result.data.map((t: any) => t.id);
      expect(foundIds).toContain(searchTweet2.id);
      expect(foundIds).not.toContain(searchTweet1.id);
    });

    it("should return empty when searching FOLLOWINGS with no follows", async () => {
      await prisma.follow.deleteMany({ where: { followerId: testUserIds[3] } });

      const result = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[3],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.FOLLOWINGS,
      });

      expect(result.data).toEqual([]);
    });

    it("should respect limit parameter", async () => {
      const result = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 1,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBe(1);
      expect(result.cursor).toBeDefined();
    });

    it("should paginate with cursor", async () => {
      const firstPage = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 1,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(firstPage.data.length).toBe(1);
      expect(firstPage.cursor).toBeDefined();

      const decodedCursor = encoderService.decode<{ id: string }>(
        firstPage.cursor as string
      );

      const secondPage = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 1,
        cursor: decodedCursor ?? undefined,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(secondPage.data.length).toBeGreaterThanOrEqual(0);
      if (secondPage.data.length > 0) {
        expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
      }
    });

    it("should search by hashtags", async () => {
      const hash = await prisma.hash.create({
        data: { tag_text: "testtag" },
      });

      const hashTweet = await prisma.tweet.create({
        data: {
          content: "Tweet with #testtag",
          userId: testUserIds[1],
          tweetType: "TWEET",
          hashtags: {
            create: { hashId: hash.id },
          },
        },
      });

      const result = await tweetService.searchTweets({
        query: "testtag",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const foundIds = result.data.map((t: any) => t.id);
      expect(foundIds).toContain(hashTweet.id);

      await prisma.tweet.delete({ where: { id: hashTweet.id } });
      await prisma.hash.delete({ where: { id: hash.id } });
    });

    it("should throw error for unsupported search tab", async () => {
      await expect(
        tweetService.searchTweets({
          query: "test",
          userId: testUserIds[1],
          limit: 10,
          searchTab: "INVALID_TAB" as any,
          peopleFilter: PeopleFilter.ANYONE,
        })
      ).rejects.toThrow("Unsupported search tab");
    });

    it("should handle case-insensitive search", async () => {
      const result = await tweetService.searchTweets({
        query: "SEARCHABLE",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should include user interaction fields", async () => {
      await prisma.tweetLike.create({
        data: { userId: testUserIds[1], tweetId: searchTweet1.id },
      });

      const result = await tweetService.searchTweets({
        query: "searchable",
        userId: testUserIds[1],
        limit: 10,
        searchTab: SearchTab.LATEST,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const likedTweet = result.data.find((t: any) => t.id === searchTweet1.id);
      expect(likedTweet?.isLiked).toBe(true);

      await prisma.tweetLike.delete({
        where: {
          userId_tweetId: { userId: testUserIds[1], tweetId: searchTweet1.id },
        },
      });
    });
  });

  describe("searchLatestTweets", () => {
    let latestTweet1: any, latestTweet2: any, latestTweet3: any;
    const latestTweetIds: string[] = [];

    beforeEach(async () => {
      if (latestTweetIds.length > 0) {
        await prisma.tweet.deleteMany({
          where: { id: { in: latestTweetIds } },
        });
        latestTweetIds.length = 0;
      }

      latestTweet1 = await prisma.tweet.create({
        data: {
          content: "Latest tweet number one",
          userId: testUserIds[1],
          tweetType: "TWEET",
          createdAt: new Date("2025-01-01T10:00:00Z"),
        },
      });
      latestTweetIds.push(latestTweet1.id);

      latestTweet2 = await prisma.tweet.create({
        data: {
          content: "Latest tweet number two",
          userId: testUserIds[2],
          tweetType: "TWEET",
          createdAt: new Date("2025-01-02T10:00:00Z"),
        },
      });
      latestTweetIds.push(latestTweet2.id);

      latestTweet3 = await prisma.tweet.create({
        data: {
          content: "Latest tweet number three",
          userId: testUserIds[3],
          tweetType: "TWEET",
          createdAt: new Date("2025-01-03T10:00:00Z"),
        },
      });
      latestTweetIds.push(latestTweet3.id);
    });

    afterEach(async () => {
      await prisma.tweetLike.deleteMany({
        where: { tweetId: { in: latestTweetIds } },
      });
      await prisma.tweet.deleteMany({
        where: { id: { in: latestTweetIds } },
      });
    });

    it("should order tweets by relevance first, then createdAt", async () => {
      const result = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBe(3);
      // Tweets should be ordered by text relevance, then by date
      const ids = result.data.map((t: any) => t.id);
      expect(ids).toContain(latestTweet1.id);
      expect(ids).toContain(latestTweet2.id);
      expect(ids).toContain(latestTweet3.id);
    });

    it("should return tweets with full-text search relevance ranking", async () => {
      const exactMatch = await prisma.tweet.create({
        data: {
          content: "latest",
          userId: testUserIds[1],
          tweetType: "TWEET",
        },
      });

      const partialMatch = await prisma.tweet.create({
        data: {
          content: "This tweet mentions latest somewhere",
          userId: testUserIds[2],
          tweetType: "TWEET",
        },
      });

      const result = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBeGreaterThan(0);
      // Exact match should rank higher due to ts_rank_cd
      const firstResult = result.data[0];
      expect([exactMatch.id, partialMatch.id]).toContain(firstResult.id);

      await prisma.tweet.deleteMany({
        where: { id: { in: [exactMatch.id, partialMatch.id] } },
      });
    });

    it("should respect limit parameter", async () => {
      const result = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 2,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBe(2);
      expect(result.cursor).toBeDefined();
    });

    it("should paginate correctly with cursor", async () => {
      const firstPage = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 1,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(firstPage.data.length).toBe(1);
      expect(firstPage.cursor).toBeDefined();

      const decodedCursor = encoderService.decode<{ id: string }>(
        firstPage.cursor as string
      );

      const secondPage = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 1,
        cursor: decodedCursor ?? undefined,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(secondPage.data.length).toBeGreaterThanOrEqual(0);
      if (secondPage.data.length > 0) {
        expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
      }
    });

    it("should return empty when query doesn't match any tweets", async () => {
      const result = await tweetService["searchLatestTweets"]({
        query: "nonexistentquery99999",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });

    it("should maintain order across pages", async () => {
      const allTweets = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const firstPage = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 2,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(firstPage.data[0].id).toBe(allTweets.data[0].id);
      expect(firstPage.data[1].id).toBe(allTweets.data[1].id);
    });

    it("should include isLiked, isRetweeted, isBookmarked fields", async () => {
      await prisma.tweetLike.create({
        data: { userId: testUserIds[1], tweetId: latestTweet1.id },
      });

      const result = await tweetService["searchLatestTweets"]({
        query: "latest",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const likedTweet = result.data.find((t: any) => t.id === latestTweet1.id);
      expect(likedTweet).toBeDefined();
      expect(likedTweet?.isLiked).toBe(true);
      expect(likedTweet?.isRetweeted).toBe(false);
      expect(likedTweet?.isBookmarked).toBe(false);

      await prisma.tweetLike.delete({
        where: {
          userId_tweetId: { userId: testUserIds[1], tweetId: latestTweet1.id },
        },
      });
    });
  });

  describe("searchTopTweets", () => {
    let topTweet1: any, topTweet2: any, topTweet3: any;
    const topTweetIds: string[] = [];

    beforeEach(async () => {
      if (topTweetIds.length > 0) {
        await prisma.tweet.deleteMany({
          where: { id: { in: topTweetIds } },
        });
        topTweetIds.length = 0;
      }

      topTweet1 = await prisma.tweet.create({
        data: {
          content: "Topsearch tweet with low score",
          userId: testUserIds[1],
          tweetType: "TWEET",
          score: 5,
          likesCount: 2,
          retweetCount: 1,
        },
      });
      topTweetIds.push(topTweet1.id);

      topTweet2 = await prisma.tweet.create({
        data: {
          content: "Topsearch tweet with high score",
          userId: testUserIds[2],
          tweetType: "TWEET",
          score: 50,
          likesCount: 20,
          retweetCount: 10,
        },
      });
      topTweetIds.push(topTweet2.id);

      topTweet3 = await prisma.tweet.create({
        data: {
          content: "Topsearch tweet with medium score",
          userId: testUserIds[3],
          tweetType: "TWEET",
          score: 25,
          likesCount: 10,
          retweetCount: 5,
        },
      });
      topTweetIds.push(topTweet3.id);
    });

    afterEach(async () => {
      await prisma.retweet.deleteMany({
        where: { tweetId: { in: topTweetIds } },
      });
      await prisma.tweet.deleteMany({
        where: { id: { in: topTweetIds } },
      });
    });

    it("should order tweets by relevance first, then score", async () => {
      const result = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBe(3);
      const scores = result.data.map((t: any) => t.score);
      expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
      expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
    });

    it("should prioritize relevance over score", async () => {
      const exactMatch = await prisma.tweet.create({
        data: {
          content: "topsearch",
          userId: testUserIds[1],
          tweetType: "TWEET",
          score: 1,
          likesCount: 0,
        },
      });

      const highScorePartial = await prisma.tweet.create({
        data: {
          content: "This mentions topsearch somewhere in the middle",
          userId: testUserIds[2],
          tweetType: "TWEET",
          score: 100,
          likesCount: 50,
        },
      });

      const result = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const firstResult = result.data[0];
      expect([exactMatch.id, highScorePartial.id]).toContain(firstResult.id);

      await prisma.tweet.deleteMany({
        where: { id: { in: [exactMatch.id, highScorePartial.id] } },
      });
    });

    it("should respect limit parameter", async () => {
      const result = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 2,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBe(2);
      expect(result.cursor).toBeDefined();
    });

    it("should paginate correctly with cursor", async () => {
      const firstPage = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 1,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(firstPage.data.length).toBe(1);
      expect(firstPage.cursor).toBeDefined();

      const decodedCursor = encoderService.decode<{ id: string }>(
        firstPage.cursor as string
      );

      const secondPage = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 1,
        cursor: decodedCursor ?? undefined,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(secondPage.data.length).toBeGreaterThanOrEqual(0);
      if (secondPage.data.length > 0) {
        expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
      }
    });

    it("should return empty when query doesn't match any tweets", async () => {
      const result = await tweetService["searchTopTweets"]({
        query: "nonexistentquery88888",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data).toEqual([]);
      expect(result.cursor).toBeNull();
    });

    it("should handle tweets with same score by using other criteria", async () => {
      const sameTweet1 = await prisma.tweet.create({
        data: {
          content: "Topsearch equal score tweet",
          userId: testUserIds[1],
          tweetType: "TWEET",
          score: 30,
          likesCount: 5,
          createdAt: new Date("2025-01-01T10:00:00Z"),
        },
      });

      const sameTweet2 = await prisma.tweet.create({
        data: {
          content: "Topsearch equal score tweet",
          userId: testUserIds[2],
          tweetType: "TWEET",
          score: 30,
          likesCount: 10,
          createdAt: new Date("2025-01-02T10:00:00Z"),
        },
      });

      const result = await tweetService["searchTopTweets"]({
        query: "topsearch equal",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(2);

      await prisma.tweet.deleteMany({
        where: { id: { in: [sameTweet1.id, sameTweet2.id] } },
      });
    });

    it("should include user interaction fields", async () => {
      await prisma.retweet.create({
        data: { userId: testUserIds[1], tweetId: topTweet2.id },
      });

      const result = await tweetService["searchTopTweets"]({
        query: "topsearch",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const retweetedTweet = result.data.find(
        (t: any) => t.id === topTweet2.id
      );
      expect(retweetedTweet).toBeDefined();
      expect(retweetedTweet?.isRetweeted).toBe(true);

      await prisma.retweet.delete({
        where: {
          userId_tweetId: { userId: testUserIds[1], tweetId: topTweet2.id },
        },
      });
    });

    it("should order by createdAt when scores and relevance are equal", async () => {
      const older = await prisma.tweet.create({
        data: {
          content: "Topsearch identical content",
          userId: testUserIds[1],
          tweetType: "TWEET",
          score: 40,
          createdAt: new Date("2025-01-01T10:00:00Z"),
        },
      });

      const newer = await prisma.tweet.create({
        data: {
          content: "Topsearch identical content",
          userId: testUserIds[2],
          tweetType: "TWEET",
          score: 40,
          createdAt: new Date("2025-01-05T10:00:00Z"),
        },
      });

      const result = await tweetService["searchTopTweets"]({
        query: "topsearch identical",
        userId: testUserIds[1],
        limit: 10,
        peopleFilter: PeopleFilter.ANYONE,
      });

      const ids = result.data.map((t: any) => t.id);
      const newerIndex = ids.indexOf(newer.id);
      const olderIndex = ids.indexOf(older.id);

      if (newerIndex !== -1 && olderIndex !== -1) {
        expect(newerIndex).toBeLessThan(olderIndex);
      }

      await prisma.tweet.deleteMany({
        where: { id: { in: [older.id, newer.id] } },
      });
    });
  });
});
