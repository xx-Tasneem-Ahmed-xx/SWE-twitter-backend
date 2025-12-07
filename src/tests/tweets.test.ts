import { initEncoderService } from "@/application/services/encoder";
import tweetService from "@/application/services/tweets";
import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";
import { prisma } from "@/prisma/client";
import { Tweet, TweetType, ReplyControl } from "@prisma/client";
let connectToDatabase: any;

beforeAll(async () => {
  await initRedis();
  await loadSecrets();
  await initEncoderService();
  connectToDatabase = (await import("@/database")).connectToDatabase;
});

describe("Tweets Service", () => {
  let publicTweet: Tweet;
  let protectedTweet: Tweet;

  beforeAll(async () => {
    await connectToDatabase();
    await prisma.media.create({
      data: {
        id: "media1",
        name: "profile1.jpg",
        keyName: "https://example.com/photo1.jpg",
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
        dateOfBirth: new Date("2002-11-1"),
        name: "Test User One",
        profileMediaId: "media1",
        bio: "I am test user one",
        verified: false,
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
        dateOfBirth: new Date("2005-10-21"),
        name: "Test User Two",
        profileMediaId: "media1",
        bio: "I am test user two",
        verified: true,
        protectedAccount: true,
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
        dateOfBirth: new Date("2003-09-21"),
        name: "Test User Three",
        profileMediaId: "media1",
        bio: "I am test user three",
        verified: true,
        protectedAccount: false,
      },
    });
    publicTweet = await prisma.tweet.create({
      data: {
        content: "shared tweet for a public unverified account",
        tweetType: "TWEET",
        userId: "123",
      },
    });
    protectedTweet = await prisma.tweet.create({
      data: {
        content: "shared tweet for a protected verified account",
        tweetType: "TWEET",
        userId: "456",
      },
    });
  });

  beforeEach(async () => {
    await prisma.mention.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.tweet.deleteMany({
      where: {
        AND: [
          { userId: { in: ["123", "456", "789"] } },
          { id: { notIn: [publicTweet.id, protectedTweet.id] } },
        ],
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: ["123", "456", "789"] } },
    });

    await prisma.tweet.deleteMany({
      where: { userId: { in: ["123", "456", "789"] } },
    });

    await prisma.retweet.deleteMany({
      where: { userId: { in: ["123", "456", "789"] } },
    });

    await prisma.media.deleteMany({
      where: { id: "media1" },
    });
    await prisma.$disconnect();
  });

  describe("createTweet", () => {
    it("should create a tweet", async () => {
      const dto = {
        content: "normal tweet",
        userId: "123",
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
  });

  describe("createQuote", () => {
    it("should create a quote tweet if parent tweet is public", async () => {
      const dto = {
        userId: "456",
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

    it("should throw if parent tweet's user is protected", async () => {
      expect(
        tweetService.createQuote({
          userId: "123",
          content: "my quote",
          parentId: protectedTweet.id,
        })
      ).rejects.toMatchObject({
        message: "You cannot quote a protected tweet",
        statusCode: 403,
      });
    });

    it("should throw if no parent tweet exists", async () => {
      await expect(
        tweetService.createQuote({
          userId: "456",
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
        userId: "456",
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

    it("should reply to a protected tweet", async () => {
      const dto = {
        userId: "789",
        content: "my reply",
        parentId: protectedTweet.id,
      };
      await prisma.follow.upsert({
        where: {
          followerId_followingId: { followerId: "789", followingId: "456" },
        },
        update: {},
        create: { followerId: "789", followingId: "456", status: "ACCEPTED" },
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
          userId: "456",
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
          userId: "123",
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
          userId: "456",
          replyControl: "VERIFIED",
        },
      });

      await expect(
        tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: "123",
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
            userId: "123",
            replyControl: "FOLLOWINGS",
          },
        });
      });
      it("should throw if user isn't from followings of the parent tweet's owner", async () => {
        await expect(
          tweetService.createReply({
            content: "test",
            parentId: parentTweet.id,
            userId: "456",
          })
        ).rejects.toMatchObject({
          message: "You cannot reply to this tweet",
          statusCode: 403,
        });
      });

      it("should reply if user is from followings of the parent tweet's owner", async () => {
        await prisma.follow.upsert({
          where: {
            followerId_followingId: { followerId: "456", followingId: "123" },
          },
          update: {},
          create: { followerId: "456", followingId: "123", status: "ACCEPTED" },
        });
        const result = await tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: "456",
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
            userId: "123",
            replyControl: "MENTIONED",
          },
        });
      });
      it("should throw if user isn't mentioned", async () => {
        await expect(
          tweetService.createReply({
            content: "test",
            parentId: parentTweet.id,
            userId: "456",
          })
        ).rejects.toMatchObject({
          message: "You cannot reply to this tweet",
          statusCode: 403,
        });
      });
      it("should reply if user is mentioned", async () => {
        await prisma.mention.create({
          data: {
            mentionedId: "456",
            mentionerId: "123",
            tweetId: parentTweet.id,
          },
        });
        const result = await tweetService.createReply({
          content: "test",
          parentId: parentTweet.id,
          userId: "456",
        });
        expect(result).not.toBeNull();
        expect(result.tweetType).toBe(TweetType.REPLY);
        expect(result.parentId).toBe(parentTweet.id);
        expect(result.userId).toBe("456");
      });
    });
  });

  describe("createRetweet", () => {
    it("should create a retweet", async () => {
      const parentTweet = await prisma.tweet.create({
        data: {
          userId: "123",
          content: "original tweet",
          tweetType: TweetType.TWEET,
        },
      });
      const result = await tweetService.createRetweet({
        userId: "123",
        parentId: parentTweet.id,
      });

      expect(result?.userId).toBe("123");
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
          userId: "123",
          parentId: "123",
        })
      ).rejects.toMatchObject({ message: "Tweet not found", statusCode: 404 });
    });
  });

  describe("getRetweets", () => {
    it("should return all retweets for a given tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: "123" },
      });

      const retweetsData = [
        { tweetId: tweet.id, userId: "123" },
        { tweetId: tweet.id, userId: "789" },
      ];

      await prisma.retweet.createMany({ data: retweetsData });

      const result = await tweetService.getRetweets(tweet.id, {
        userId: tweet.userId,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      const userIds = result.data.map((r: any) => r.id);
      expect(userIds).toEqual(expect.arrayContaining(["123", "789"]));
    });

    it("should throw if parent tweet id is invalid", async () => {
      await expect(
        tweetService.getRetweets("123", { userId: "123", limit: 3 })
      ).rejects.toMatchObject({
        message: "Tweet not found",
        statusCode: 404,
      });
    });
  });

  describe("deleteTweet", () => {
    it("should delete an existing tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: "123" },
      });

      await tweetService.deleteTweet(tweet.id);
      const result = await prisma.tweet.findUnique({
        where: { id: tweet.id },
      });
      expect(result).toBe(null);
    });

    it("should delete an existing reply and decrement reply count of parent tweet", async () => {
      const tweet = await prisma.tweet.create({
        data: { content: "hello", tweetType: "TWEET", userId: "123" },
      });

      const reply = await prisma.tweet.create({
        data: {
          content: "reply",
          tweetType: "REPLY",
          userId: "456",
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
        data: { content: "hello", tweetType: "TWEET", userId: "123" },
      });

      const quote = await prisma.tweet.create({
        data: {
          content: "quote",
          tweetType: "QUOTE",
          userId: "456",
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
        data: { content: "hello", tweetType: "TWEET", userId: "123" },
      });

      await prisma.retweet.create({
        data: { tweetId: tweet.id, userId: "456" },
      });
      await prisma.tweet.update({
        where: { id: tweet.id },
        data: { retweetCount: { increment: 1 } },
      });
      await tweetService.deleteRetweet("456", tweet.id);
      const result = await prisma.retweet.findUnique({
        where: { userId_tweetId: { userId: "456", tweetId: tweet.id } },
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
          data: { content: "tweet one", userId: "456", tweetType: "TWEET" },
        }),
        prisma.tweet.create({
          data: { content: "tweet two", userId: "789", tweetType: "QUOTE" },
        }),
        prisma.tweet.create({
          data: { content: "tweet three", userId: "123", tweetType: "REPLY" },
        }),
      ]);
      await prisma.tweetLike.createMany({
        data: [
          {
            userId: "123",
            tweetId: tweet1.id,
            createdAt: new Date("2025-12-05T10:00:00Z"),
          },
          {
            userId: "123",
            tweetId: tweet2.id,
            createdAt: new Date("2025-12-05T10:05:00Z"),
          },
          {
            userId: "123",
            tweetId: tweet3.id,
            createdAt: new Date("2025-12-05T10:10:00Z"),
          },
        ],
      });

      const res = await tweetService.getLikedTweets({
        userId: "123",
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
            userId: "456",
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
        prisma.tweet.create({
          data: {
            content: "reply two",
            userId: "789",
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
        prisma.tweet.create({
          data: {
            content: "reply three",
            userId: "123",
            tweetType: "REPLY",
            parentId: publicTweet.id,
          },
        }),
      ]);
      const res = await tweetService.getTweetRepliesOrQuotes(publicTweet.id, {
        userId: "123",
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
      await tweetService.likeTweet("456", publicTweet.id);

      const updatedtweet = await prisma.tweet.findUnique({
        where: { id: publicTweet.id },
      });
      expect(updatedtweet?.likesCount).toBe(1);
      const res = await prisma.tweetLike.findUnique({
        where: { userId_tweetId: { userId: "456", tweetId: publicTweet.id } },
      });
      expect(res).toBeDefined();
    });
    it("should throw when liking an already liked tweet", async () => {
      await expect(
        tweetService.likeTweet("456", publicTweet.id)
      ).rejects.toMatchObject({
        message: "Tweet already liked",
        statusCode: 409,
      });
    });
  });

  describe("deleteLike", () => {
    it("should delete a like on a tweet", async () => {
      await tweetService.deleteLike("456", publicTweet.id);

      const res = await prisma.tweetLike.findUnique({
        where: { userId_tweetId: { userId: "456", tweetId: publicTweet.id } },
      });
      expect(res).toBeNull();
    });

    it("should throw when deleting a non existent like", async () => {
      await expect(
        tweetService.deleteLike("456", publicTweet.id)
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
          { userId: "123", tweetId: publicTweet.id },
          { userId: "456", tweetId: publicTweet.id },
          { userId: "789", tweetId: publicTweet.id },
        ],
      });

      const res = await tweetService.getLikers(publicTweet.id, {
        limit: 10,
        userId: "123",
      });
      const likersIds = res.data.map((like) => like.id);

      expect(likersIds).toEqual(expect.arrayContaining(["123", "456", "789"]));
      expect(res.data).toHaveLength(3);
    });
  });

  describe("getUserTweets", () => {
    it("should return all tweet for a user", async () => {
      const [quote, reply] = await Promise.all([
        prisma.tweet.create({
          data: { userId: "456", content: "bla bla bla", tweetType: "QUOTE" },
        }),
        prisma.tweet.create({
          data: { userId: "456", content: "bla bla bla", tweetType: "REPLY" },
        }),
      ]);

      const res = await tweetService.getUserTweets(
        {
          userId: "456",
          limit: 10,
        },
        "123"
      );

      const tweetIds = res.data.map((tweet) => tweet.id);

      expect(tweetIds).toEqual(
        expect.arrayContaining([reply.id, quote.id, protectedTweet.id])
      );
      expect(res.data).toHaveLength(3);
    });
  });

  describe("getMentionedTweets", () => {
    it("should return tweets where the user is mentioned", async () => {
      const [tweet1, tweet2, tweet3] = await Promise.all([
        prisma.tweet.create({
          data: { content: "tweet one", userId: "123", tweetType: "TWEET" },
        }),
        prisma.tweet.create({
          data: { content: "tweet two", userId: "456", tweetType: "TWEET" },
        }),
        prisma.tweet.create({
          data: { content: "tweet three", userId: "789", tweetType: "TWEET" },
        }),
      ]);

      await prisma.mention.createMany({
        data: [
          { mentionedId: "123", mentionerId: "123", tweetId: tweet1.id },
          { mentionedId: "123", mentionerId: "456", tweetId: tweet2.id },
          { mentionedId: "123", mentionerId: "789", tweetId: tweet3.id },
        ],
      });

      const res = await tweetService.getMentionedTweets({
        userId: "123",
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
          data: { content: "tweet one", userId: "456", tweetType: "TWEET" },
        }),
        prisma.tweet.create({
          data: { content: "tweet two", userId: "789", tweetType: "TWEET" },
        }),
      ]);

      await prisma.mention.createMany({
        data: [
          { mentionedId: "123", mentionerId: "456", tweetId: tweet1.id },
          { mentionedId: "123", mentionerId: "789", tweetId: tweet2.id },
        ],
      });

      const res = await tweetService.getMentionedTweets({
        userId: "123",
        limit: 1,
      });

      expect(res.data).toHaveLength(1);
      expect(res.cursor).toBeDefined();
    });
  });
});
