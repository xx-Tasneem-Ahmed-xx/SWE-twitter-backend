import { prisma, TweetType } from "@/prisma/client";
import {
  validToRetweetOrQuote,
  validToReply,
} from "@/application/utils/tweet.utils";
import {
  CreateReplyOrQuoteServiceDTO,
  CreateReTweetServiceDto,
  CreateTweetServiceDto,
  InteractionsCursorServiceDTO,
  SearchServiceDTO,
  TweetCursorServiceDTO,
} from "@/application/dtos/tweets/service/tweets.dto";
import { AppError } from "@/errors/AppError";
import {
  generateTweetCategory,
  generateTweetSumamry,
} from "@/application/services/aiSummary";
import { SearchServiceSchema } from "@/application/dtos/tweets/service/tweets.dto.schema";
import {
  PeopleFilter,
  SearchTab,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { SearchParams } from "@/types/types";
import { encoderService } from "@/application/services/encoder";
import {
  enqueueCategorizeTweetJob,
  enqueueHashtagJob,
} from "@/background/jobs/hashtags";
import { Prisma } from "@prisma/client";
import { UUID } from "node:crypto";
import { addNotification } from "./notification";

class TweetService {
  private async validateId(id: string) {
    if (!id || typeof id !== "string") {
      throw new AppError("Invalid ID", 400);
    }
    const tweet = await prisma.tweet.findUnique({ where: { id } });
    if (!tweet) throw new AppError("Tweet not found", 404);
  }

  private async saveMentionedUsersTx(
    tx: Prisma.TransactionClient,
    tweetId: string,
    content: string,
    mentionerId: string
  ) {
    const MENTION_REGEX = /@(\w+)/g;
    const usernames =
      content.match(MENTION_REGEX)?.map((u) => u.slice(1)) || [];

    if (usernames.length === 0) return;

    const mentionedUsers = await tx.user.findMany({
      where: {
        AND: [
          { username: { in: usernames } },
          { blocked: { none: { blockerId: mentionerId } } },
        ],
      },
      select: { id: true },
    });

    if (mentionedUsers.length === 0) return;

    mentionedUsers.map((user) =>
      addNotification(user.id as UUID, {
        title: "MENTION",
        body: "mentioned you",
        tweetId,
        actorId: mentionerId,
      })
    );

    await tx.mention.createMany({
      data: mentionedUsers.map((user) => ({
        mentionerId,
        mentionedId: user.id,
        tweetId,
      })),
      skipDuplicates: true,
    });
  }

  private async saveTweetMediasTx(
    tx: Prisma.TransactionClient,
    tweetId: string,
    mediaIds?: string[]
  ) {
    if (!mediaIds?.length) return;

    const data = mediaIds.map((mediaId) => ({
      mediaId,
      tweetId,
    }));

    await tx.tweetMedia.createMany({ data });
  }

  private updateCursor<T>(
    records: T[],
    limit: number,
    getCursorFn: (record: T) => Record<string, any>
  ) {
    const hasNextPage = records.length > limit;
    const paginatedRecords = hasNextPage ? records.slice(0, -1) : records;

    const lastRecord = paginatedRecords[paginatedRecords.length - 1];
    const cursor = lastRecord ? getCursorFn(lastRecord) : null;

    return {
      paginatedRecords,
      cursor: hasNextPage ? encoderService.encode(cursor) : null,
    };
  }

  private checkUserInteractions(tweets: any[]) {
    return tweets.map((t) => {
      const { tweetLikes, retweets, tweetBookmark, ...tweet } = t;
      return {
        ...tweet,
        isLiked: tweetLikes.length > 0,
        isRetweeted: retweets.length > 0,
        isBookmarked: tweetBookmark.length > 0,
      };
    });
  }

  async createTweet(dto: CreateTweetServiceDto) {
    return await prisma.$transaction(async (tx) => {
      const tweet = await tx.tweet.create({
        data: {
          content: dto.content,
          replyControl: dto.replyControl,
          tweetType: TweetType.TWEET,
          userId: dto.userId,
        },
      });

      await this.saveTweetMediasTx(tx, tweet.id, dto.mediaIds);

      await this.saveMentionedUsersTx(
        tx,
        tweet.id,
        tweet.content,
        tweet.userId
      );

      enqueueHashtagJob({ tweetId: tweet.id, content: tweet.content }).catch(
        () => console.log("Failed to enqueue hashtag job for tweet")
      );

      enqueueCategorizeTweetJob({
        tweetId: tweet.id,
        content: tweet.content,
      }).catch(() => console.log("Failed to enqueue categorize job for tweet"));

      return tweet;
    });
  }

  async createQuote(dto: CreateReplyOrQuoteServiceDTO) {
    await this.validateId(dto.parentId);
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (!valid) throw new AppError("You cannot quote a protected tweet", 403);

    return await prisma.$transaction(async (tx) => {
      const quote = await tx.tweet.create({
        data: {
          content: dto.content,
          replyControl: dto.replyControl,
          tweetType: TweetType.QUOTE,
          userId: dto.userId,
          parentId: dto.parentId,
        },
      });

      const parent = await tx.tweet.update({
        where: { id: dto.parentId },
        data: { quotesCount: { increment: 1 } },
        select: { userId: true },
      });

      await this.saveTweetMediasTx(tx, quote.id, dto.mediaIds);

      await this.saveMentionedUsersTx(
        tx,
        quote.id,
        quote.content,
        quote.userId
      );

      enqueueHashtagJob({
        tweetId: quote.id,
        content: quote.content,
      }).catch(() => console.log("Failed to enqueue hashtag job for quote"));

      enqueueCategorizeTweetJob({
        tweetId: quote.id,
        content: quote.content,
      }).catch(() => console.log("Failed to enqueue categorize job for tweet"));

      addNotification(parent.userId as UUID, {
        title: "QUOTE",
        body: "someone quoted you",
        tweetId: dto.parentId,
        actorId: dto.userId,
      });

      return quote;
    });
  }

  async createReply(dto: CreateReplyOrQuoteServiceDTO) {
    await this.validateId(dto.parentId);
    const valid = await validToReply(dto.parentId, dto.userId);
    if (!valid) throw new AppError("You cannot reply to this tweet", 403);

    return await prisma.$transaction(async (tx) => {
      const reply = await tx.tweet.create({
        data: {
          content: dto.content,
          replyControl: dto.replyControl,
          tweetType: TweetType.REPLY,
          userId: dto.userId,
          parentId: dto.parentId,
        },
      });

      const parent = await tx.tweet.update({
        where: { id: dto.parentId },
        data: { repliesCount: { increment: 1 } },
        select: { userId: true },
      });

      await this.saveTweetMediasTx(tx, reply.id, dto.mediaIds);

      await this.saveMentionedUsersTx(
        tx,
        reply.id,
        reply.content,
        reply.userId
      );

      enqueueHashtagJob({
        tweetId: reply.id,
        content: reply.content,
      }).catch(() => console.log("Failed to enqueue hashtag job for reply"));

      enqueueCategorizeTweetJob({
        tweetId: reply.id,
        content: reply.content,
      }).catch(() => console.log("Failed to enqueue categorize job for tweet"));

      addNotification(parent.userId as UUID, {
        title: "REPLY",
        body: "someone replied to",
        tweetId: dto.parentId,
        actorId: dto.userId,
      });

      return reply;
    });
  }

  async createRetweet(dto: CreateReTweetServiceDto) {
    await this.validateId(dto.parentId);
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (!valid) throw new AppError("You cannot retweet a protected tweet", 403);

    return await prisma.$transaction(async (tx) => {
      const retweet = await tx.retweet.create({
        data: { userId: dto.userId, tweetId: dto.parentId },
      });

      const parent = await tx.tweet.update({
        where: { id: dto.parentId },
        data: { retweetCount: { increment: 1 } },
        select: { userId: true },
      });

      addNotification(parent.userId as UUID, {
        title: "RETWEET",
        body: "reposted your post",
        tweetId: dto.parentId,
        actorId: dto.userId,
      });
      return retweet;
    });
  }

  async getRetweets(tweetId: string, dto: InteractionsCursorServiceDTO) {
    await this.validateId(tweetId);
    const retweeters = await prisma.retweet.findMany({
      where: ( {
        tweetId,
        ...(dto.cursor && {
          OR: [
            { createdAt: { lt: dto.cursor.createdAt } },
            {
              AND: [
                { createdAt: dto.cursor.createdAt },
                { userId: { lt: dto.cursor.userId } },
              ],
            },
          ],
        }),
      } as any),
      select: ( {
        user: {
          select: this.userSelectFields(),
        },
        createdAt: true,
        userId: true,
      } as any ),
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }] as any,
      take: dto.limit + 1,
    });

    const { cursor, paginatedRecords } = this.updateCursor(
      retweeters,
      dto.limit,
      (record) => ({ userId: record.userId, createdAt: record.createdAt })
    );
    const data = paginatedRecords.map((retweet) => ({ ...retweet.user }));

    return {
      data,
      cursor,
    };
  }

  async getTweet(id: string, userId: string) {
    await this.validateId(id);
    const tweet = await prisma.tweet.findUnique({
      where: { id },
      select: this.tweetSelectFields(userId),
    });
    if (!tweet) throw new AppError("Tweet not found", 404);
    return this.checkUserInteractions([tweet])[0];
  }

  async updateTweet(id: string, content: string) {
    await this.validateId(id);
    return prisma.tweet.update({
      where: { id },
      data: { content },
      select: { id: true },
    });
  }

  async deleteTweet(id: string) {
    await this.validateId(id);
    const tweet = await prisma.tweet.findUnique({
      where: { id },
      select: { parentId: true, tweetType: true },
    });

    if (!tweet) throw new AppError("Tweet not found", 404);

    if (!tweet.parentId)
      return prisma.$transaction([
        prisma.retweet.deleteMany({ where: { tweetId: id } }),
        prisma.tweet.delete({ where: { id } }),
      ]);

    if (tweet.tweetType === "REPLY")
      return this.deleteReply(id, tweet.parentId);

    if (tweet.tweetType === "QUOTE")
      return this.deleteQuote(id, tweet.parentId);
  }

  private async deleteReply(id: string, parentId: string) {
    await this.validateId(id);
    return prisma.$transaction([
      prisma.tweet.delete({ where: { id } }),
      prisma.retweet.deleteMany({ where: { tweetId: id } }),
      prisma.tweet.update({
        where: { id: parentId },
        data: { repliesCount: { decrement: 1 } },
      }),
    ]);
  }

  private async deleteQuote(id: string, parentId: string) {
    await this.validateId(id);
    return prisma.$transaction([
      prisma.tweet.delete({ where: { id } }),
      prisma.retweet.deleteMany({ where: { tweetId: id } }),
      prisma.tweet.update({
        where: { id: parentId },
        data: { quotesCount: { decrement: 1 } },
      }),
    ]);
  }

  async deleteRetweet(userId: string, tweetId: string) {
    await this.validateId(tweetId);
    return prisma.$transaction([
      prisma.retweet.delete({
        where: { userId_tweetId: { userId, tweetId } },
      }),
      prisma.tweet.update({
        where: { id: tweetId },
        data: { retweetCount: { decrement: 1 } },
      }),
    ]);
  }

  async getLikedTweets(dto: InteractionsCursorServiceDTO) {
    const where: any = { userId: dto.userId };
    if (dto.cursor) {
      where.OR = [
        { createdAt: { lt: dto.cursor.createdAt } },
        {
          AND: [
            { createdAt: dto.cursor.createdAt },
            { userId: { lt: dto.cursor.userId } },
          ],
        },
      ];
    }

    const tweetLikes = await prisma.tweetLike.findMany({
      where,
      include: {
        tweet: {
          select: {
            ...this.tweetSelectFields(dto.userId),
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }] as any,
      take: dto.limit + 1,
    });

    const { cursor, paginatedRecords } = this.updateCursor(
      tweetLikes,
      dto.limit,
      (record) => ({ userId: record.userId, createdAt: record.createdAt })
    );
    const rawTweets = paginatedRecords.map((t) => t.tweet);
    const data = this.checkUserInteractions(rawTweets);

    return {
      data,
      cursor,
    };
  }

  async getTweetReplies(tweetId: string, dto: TweetCursorServiceDTO) {
    const replies = await prisma.tweet.findMany({
      where: { parentId: tweetId },
      select: {
        ...this.tweetSelectFields(dto.userId),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });
    const { cursor, paginatedRecords } = this.updateCursor(
      replies,
      dto.limit,
      (record) => ({ id: record.id, createdAt: record.createdAt })
    );

    const data = this.checkUserInteractions(paginatedRecords);
    return {
      data,
      cursor,
    };
  }

  async likeTweet(userId: string, tweetId: string) {
    await this.validateId(tweetId);
    const tweet = await prisma.tweet.findUnique({ where: { id: tweetId } });
    if (!tweet) throw new AppError("Tweet not found", 404);

    const existingLike = await prisma.tweetLike.findUnique({
      where: { userId_tweetId: { userId, tweetId } },
    });

    if (existingLike) throw new AppError("Tweet already liked", 409);
    return await prisma.$transaction(async (tx) => {
      const parent = await tx.tweet.update({
        where: { id: tweetId },
        data: { likesCount: { increment: 1 } },
      });

      await tx.tweetLike.create({
        data: { userId, tweetId },
      });
      addNotification(parent.userId as UUID, {
        title: "LIKE",
        body: "liked your post",
        tweetId: tweetId,
        actorId: userId,
      });
    });
  }

  async deleteLike(userId: string, tweetId: string) {
    await this.validateId(tweetId);
    const existingLike = await prisma.tweetLike.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId,
        },
      },
    });

    if (!existingLike) {
      throw new AppError("You haven't liked this tweet yet", 409);
    }

    return prisma.$transaction([
      prisma.tweetLike.delete({
        where: { userId_tweetId: { userId, tweetId } },
      }),
      prisma.tweet.update({
        where: { id: tweetId },
        data: { likesCount: { decrement: 1 } },
      }),
    ]);
  }

  async getLikers(tweetId: string, dto: InteractionsCursorServiceDTO) {
    await this.validateId(tweetId);
    const records = await prisma.tweetLike.findMany({
      where: { tweetId },
      select: {
        user: {
          select: this.userSelectFields(),
        },
        createdAt: true,
        userId: true,
      },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && {
        cursor: {
          userId_createdAt: {
            userId: dto.cursor.userId,
            createdAt: dto.cursor.createdAt,
          },
        },
        skip: 1,
      }),
    });

    const { cursor, paginatedRecords } = this.updateCursor(
      records,
      dto.limit,
      (record) => ({ userId: record.userId, createdAt: record.createdAt })
    );

    return {
      data: paginatedRecords.map((record) => ({ ...record.user })),
      cursor,
    };
  }

  async getTweetSummary(tweetId: string) {
    await this.validateId(tweetId);

    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { content: true },
    });

    if (!tweet) throw new AppError("Tweet not found", 404);

    const existingSummary = await prisma.tweetSummary.findUnique({
      where: { tweetId },
      select: { summary: true },
    });

    if (existingSummary) return existingSummary;

    const summary = await generateTweetSumamry(tweet.content);
    await prisma.tweetSummary.create({ data: { tweetId, summary } });

    return {
      summary: summary,
    };
  }

  async getUserTweets(dto: TweetCursorServiceDTO, currentUserId: string) {
    const tweets = await prisma.tweet.findMany({
      where: { userId: dto.userId },
      select: {
        ...this.tweetSelectFields(currentUserId),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });

    const { cursor, paginatedRecords } = this.updateCursor(
      tweets,
      dto.limit,
      (record) => ({ id: record.id, createdAt: record.createdAt })
    );
    const data = this.checkUserInteractions(paginatedRecords);
    return {
      data,
      cursor,
    };
  }

  async getMentionedTweets(dto: TweetCursorServiceDTO) {
    const tweets = await prisma.tweet.findMany({
      where: {
        mention: {
          some: { mentionedId: dto.userId },
        },
      },
      select: this.tweetSelectFields(dto.userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });

    const { cursor, paginatedRecords } = this.updateCursor(
      tweets,
      dto.limit,
      (record) => ({ id: record.id, createdAt: record.createdAt })
    );
    const data = this.checkUserInteractions(paginatedRecords);
    return {
      data,
      cursor,
    };
  }

  async categorizeTweet(
    id: string,
    tweetContent: string,
    tx: Prisma.TransactionClient
  ) {
    const categories = await generateTweetCategory(tweetContent);
    const categoryRecords = await tx.category.findMany({
      where: {
        name: { in: categories },
      },
      select: { id: true },
    });

    if (categoryRecords.length === 0) return;

    await tx.tweet.update({
      where: { id },
      data: {
        category: {
          set: [],
          connect: categoryRecords.map((category) => ({ id: category.id })),
        },
      },
    });
  }

  async searchTweets(dto: SearchServiceDTO) {
    const parsedDTO = SearchServiceSchema.parse(dto);

    const wherePrismaFilter = this.generateFilter(
      parsedDTO.query,
      parsedDTO.userId,
      parsedDTO.peopleFilter
    );

    const selectFields = this.tweetSelectFields(dto.userId);

    const searchParams = {
      where: wherePrismaFilter,
      select: selectFields,
      limit: parsedDTO.limit,
      cursor: parsedDTO.cursor,
    };

    switch (parsedDTO.searchTab) {
      case SearchTab.LATEST:
        return this.searchLatestTweets(searchParams);

      case SearchTab.TOP:
        return this.searchTopTweets(searchParams);

      default:
        throw new Error("Unsupported search tab");
    }
  }

  private async searchLatestTweets({
    where,
    select,
    limit,
    cursor,
  }: SearchParams) {
    return prisma.tweet.findMany({
      where,
      select,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
  }

  private async searchTopTweets({
    where,
    select,
    limit,
    cursor,
  }: SearchParams) {
    //if top calculate score for each tweet then sort accrodingly
  }

  private async generateFilter(
    query: string,
    userId: string,
    peopleFilter: PeopleFilter
  ) {
    const where: any = {
      OR: [
        { content: { contains: query, mode: "insensitive" } },
        {
          hashtags: {
            some: {
              hash: { tag_text: { contains: query, mode: "insensitive" } },
            },
          },
        },
      ],
    };

    if (peopleFilter === PeopleFilter.FOLLOWINGS) {
      const followingRecords = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = followingRecords.map((record) => record.followingId);

      where.userId = { in: followingIds };
    }
    return where;
  }

  private userSelectFields() {
    return {
      id: true,
      name: true,
      username: true,
      profileMedia: { select: { id: true } },
      protectedAccount: true,
      verified: true,
    };
  }

  private tweetSelectFields(userId: string) {
    return {
      id: true,
      content: true,
      createdAt: true,
      likesCount: true,
      repliesCount: true,
      quotesCount: true,
      retweetCount: true,
      replyControl: true,
      tweetType: true,
      parentId: true,
      userId: true,
      user: {
        select: this.userSelectFields(),
      },
      tweetLikes: {
        where: { userId },
        select: { userId: true },
      },
      retweets: {
        where: { userId },
        select: { userId: true },
      },
      tweetBookmark: {
        where: { userId },
        select: { userId: true },
      },
      tweetMedia: { select: { mediaId: true } },
    };
  }
}

const tweetService = new TweetService();
export default tweetService;
