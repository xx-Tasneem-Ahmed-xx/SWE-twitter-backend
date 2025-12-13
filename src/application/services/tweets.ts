import { prisma, TweetType } from "@/prisma/client";
import {
  validToRetweetOrQuote,
  validToReply,
  updateCursor,
  userSelectFields,
  tweetSelectFields,
  mediaSelectFields,
} from "@/application/utils/tweet.utils";
import {
  CreateReplyOrQuoteServiceDTO,
  CreateReTweetServiceDto,
  CreateTweetServiceDto,
  InteractionsCursorServiceDTO,
  SearchServiceDTO,
  TweetCursorServiceDTO,
  UpdateTweetServiceDTO,
} from "@/application/dtos/tweets/service/tweets.dto";
import * as responseUtils from "@/application/utils/response.utils";
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
import {
  enqueueCategorizeTweetJob,
  enqueueHashtagJob,
} from "@/background/jobs/hashtags";
import { Prisma } from "@prisma/client";
import { UUID } from "node:crypto";
import { addNotification } from "./notification";
import { enqueueUpdateScoreJob } from "@/background/jobs/explore";

export class TweetService {
  private async validateId(id: string) {
    if (!id) {
      responseUtils.throwError("INVALID_ID");
    }
    const tweet = await prisma.tweet.findUnique({ where: { id } });
    if (!tweet) responseUtils.throwError("TWEET_NOT_FOUND");
  }

  private async getActor(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
    });
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

    const mentioner = await this.getActor(mentionerId);

    if (mentionedUsers.length === 0) return;

    mentionedUsers.forEach(
      async (user) =>
        await addNotification(user.id as UUID, {
          title: "MENTION",
          body: `${mentioner?.name} mentioned you`,
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

    await tx.tweetMedia.createMany({ data, skipDuplicates: true });
  }

  private formatUser(user: any) {
    if (!user) return {};
    const { _count, ...restUser } = user ?? {};
    return {
      ...restUser,
      isFollowed: (_count?.followers ?? 0) > 0,
    };
  }

  public checkUserInteractions(tweets: any[]) {
    return tweets.map((t) => {
      const { tweetLikes, retweets, tweetBookmark, user, ...tweet } = t;

      return {
        ...tweet,
        user: this.formatUser(user),
        isLiked: tweetLikes.length > 0,
        isRetweeted: retweets.length > 0,
        isBookmarked: tweetBookmark.length > 0,
      };
    });
  }

  public async normalizeTweetsAndRetweets(
    dto: TweetCursorServiceDTO,
    currentUserId: string,
    tweets: any[]
  ) {
    const retweetedTweets = await prisma.retweet.findMany({
      where: { userId: dto.userId },
      select: {
        createdAt: true,
        tweet: {
          select: tweetSelectFields(currentUserId),
        },
        user: { select: userSelectFields(currentUserId) },
      },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && {
        cursor: {
          userId_createdAt: {
            userId: dto.userId,
            createdAt: dto.cursor.createdAt,
          },
        },
        skip: 1,
      }),
    });

    const normalizedRetweets = retweetedTweets.map((r) => ({
      ...r.tweet,
      createdAt: r.createdAt,
      retweeter: this.formatUser(r.user),
    }));

    const allTweets = [...tweets, ...normalizedRetweets]
      .slice(0, dto.limit + 1)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return allTweets;
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
    if (!valid) responseUtils.throwError("CANNOT_QUOTE_PROTECTED_TWEET");

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

      enqueueUpdateScoreJob({ tweetId: dto.parentId });

      const actor = await this.getActor(dto.userId);
      await addNotification(parent.userId as UUID, {
        title: "QUOTE",
        body: `${actor?.name} quoted your post`,
        tweetId: dto.parentId,
        actorId: dto.userId,
      });

      return quote;
    });
  }

  async createReply(dto: CreateReplyOrQuoteServiceDTO) {
    await this.validateId(dto.parentId);
    const valid = await validToReply(dto.parentId, dto.userId);
    if (!valid) responseUtils.throwError("CANNOT_REPLY_TO_TWEET");

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

      enqueueUpdateScoreJob({ tweetId: dto.parentId });

      const actor = await this.getActor(dto.userId);
      await addNotification(parent.userId as UUID, {
        title: "REPLY",
        body: `${actor?.name} replied to your post`,
        tweetId: dto.parentId,
        actorId: dto.userId,
      });

      return reply;
    });
  }

  async createRetweet(dto: CreateReTweetServiceDto) {
    await this.validateId(dto.parentId);
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (!valid) responseUtils.throwError("CANNOT_RETWEET_PROTECTED_TWEET");

    return await prisma.$transaction(async (tx) => {
      const retweet = await tx.retweet.create({
        data: { userId: dto.userId, tweetId: dto.parentId },
      });

      const parent = await tx.tweet.update({
        where: { id: dto.parentId },
        data: { retweetCount: { increment: 1 } },
        select: { userId: true },
      });
      enqueueUpdateScoreJob({ tweetId: dto.parentId });
      const actor = await this.getActor(dto.userId);
      await addNotification(parent.userId as UUID, {
        title: "RETWEET",
        body: `${actor?.name} reposted your post`,
        tweetId: dto.parentId,
        actorId: dto.userId,
      });
      return retweet;
    });
  }

  async getRetweets(tweetId: string, dto: InteractionsCursorServiceDTO) {
    await this.validateId(tweetId);
    const retweeters = await prisma.retweet.findMany({
      where: { tweetId },
      select: {
        user: {
          select: userSelectFields(dto.userId),
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

    const { cursor, paginatedRecords } = updateCursor(
      retweeters,
      dto.limit,
      (record) => ({ userId: record.userId, createdAt: record.createdAt })
    );
    const data = paginatedRecords.map((retweet) =>
      this.formatUser(retweet.user)
    );

    return {
      data,
      cursor,
    };
  }

  async getTweet(id: string, userId: string) {
    await this.validateId(id);
    const tweet = await prisma.tweet.findUnique({
      where: { id },
      select: tweetSelectFields(userId),
    });
    if (!tweet) responseUtils.throwError("TWEET_NOT_FOUND");
    return this.checkUserInteractions([tweet])[0];
  }

  async updateTweet(id: string, dto: UpdateTweetServiceDTO) {
    await this.validateId(id);
    const tweet = await prisma.tweet.findUnique({
      where: { id, userId: dto.userId },
      select: { id: true },
    });
    if (!tweet) responseUtils.throwError("TWEET_OWNER_ACCESS");

    const data: any = {};
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.replyControl !== undefined) data.replyControl = dto.replyControl;
    if (dto.tweetMedia !== undefined) {
      await prisma.tweetMedia.deleteMany({
        where: { tweetId: id },
      });

      data.tweetMedia = {
        create: dto.tweetMedia.map((mediaId) => ({
          mediaId,
        })),
      };
    }

    if (Object.keys(data).length === 0)
      responseUtils.throwError("TWEET_UPDATE_FIELDS");

    return prisma.tweet.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  async deleteTweet(id: string) {
    await this.validateId(id);
    const tweet = await prisma.tweet.findUnique({
      where: { id },
      select: { parentId: true, tweetType: true },
    });

    if (!tweet) responseUtils.throwError("TWEET_NOT_FOUND");

    if (!tweet!.parentId)
      return prisma.$transaction([
        prisma.retweet.deleteMany({ where: { tweetId: id } }),
        prisma.tweet.delete({ where: { id } }),
      ]);

    if (tweet!.tweetType === "REPLY")
      return this.deleteReply(id, tweet!.parentId);

    if (tweet!.tweetType === "QUOTE")
      return this.deleteQuote(id, tweet!.parentId);
  }

  private async deleteReply(id: string, parentId: string) {
    await this.validateId(id);
    return await prisma.$transaction(async (tx) => {
      await tx.tweet.delete({ where: { id } });
      await tx.retweet.deleteMany({ where: { tweetId: id } });
      await tx.tweet.update({
        where: { id: parentId },
        data: { repliesCount: { decrement: 1 } },
      });
      enqueueUpdateScoreJob({ tweetId: parentId });
    });
  }

  private async deleteQuote(id: string, parentId: string) {
    await this.validateId(id);
    return await prisma.$transaction(async (tx) => {
      await tx.tweet.delete({ where: { id } });
      await tx.retweet.deleteMany({ where: { tweetId: id } });
      await tx.tweet.update({
        where: { id: parentId },
        data: { quotesCount: { decrement: 1 } },
      });
      enqueueUpdateScoreJob({ tweetId: parentId });
    });
  }

  async deleteRetweet(userId: string, tweetId: string) {
    await this.validateId(tweetId);
    return await prisma.$transaction(async (tx) => {
      await tx.retweet.delete({
        where: { userId_tweetId: { userId, tweetId } },
      });
      await tx.tweet.update({
        where: { id: tweetId },
        data: { retweetCount: { decrement: 1 } },
      });
      enqueueUpdateScoreJob({ tweetId });
    });
  }

  async getLikedTweets(dto: InteractionsCursorServiceDTO) {
    const tweetLikes = await prisma.tweetLike.findMany({
      where: { userId: dto.userId },
      select: {
        tweet: {
          select: {
            ...tweetSelectFields(dto.userId),
          },
        },
        createdAt: true,
        userId: true,
      },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && {
        cursor: {
          userId_createdAt: {
            userId: dto.userId,
            createdAt: dto.cursor.createdAt,
          },
        },
        skip: 1,
      }),
    });

    const { cursor, paginatedRecords } = updateCursor(
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

  async getTweetRepliesOrQuotes(tweetId: string, dto: TweetCursorServiceDTO) {
    const replies = await prisma.tweet.findMany({
      where: { parentId: tweetId, tweetType: dto.tweetType },
      select: {
        ...tweetSelectFields(dto.userId),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });
    const { cursor, paginatedRecords } = updateCursor(
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
    if (!tweet) responseUtils.throwError("TWEET_NOT_FOUND");

    const existingLike = await prisma.tweetLike.findUnique({
      where: { userId_tweetId: { userId, tweetId } },
    });

    if (existingLike) responseUtils.throwError("TWEET_ALREADY_LIKED");
    return await prisma.$transaction(async (tx) => {
      const parent = await tx.tweet.update({
        where: { id: tweetId },
        data: { likesCount: { increment: 1 } },
      });

      await tx.tweetLike.create({
        data: { userId, tweetId },
      });
      enqueueUpdateScoreJob({ tweetId });
      const actor = await this.getActor(userId);
      await addNotification(parent.userId as UUID, {
        title: "LIKE",
        body: `${actor?.name} liked your post`,
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
      responseUtils.throwError("TWEET_NOT_LIKED_YET");
    }

    return await prisma.$transaction(async (tx) => {
      await tx.tweetLike.delete({
        where: { userId_tweetId: { userId, tweetId } },
      });

      await tx.tweet.update({
        where: { id: tweetId },
        data: { likesCount: { decrement: 1 } },
      });
      enqueueUpdateScoreJob({ tweetId });
    });
  }

  async getLikers(tweetId: string, dto: InteractionsCursorServiceDTO) {
    await this.validateId(tweetId);
    const records = await prisma.tweetLike.findMany({
      where: { tweetId },
      select: {
        user: {
          select: userSelectFields(dto.userId),
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

    const { cursor, paginatedRecords } = updateCursor(
      records,
      dto.limit,
      (record) => ({ userId: record.userId, createdAt: record.createdAt })
    );

    return {
      data: paginatedRecords.map((record) => this.formatUser(record.user)),
      cursor,
    };
  }

  async getTweetSummary(tweetId: string) {
    await this.validateId(tweetId);

    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { content: true },
    });

    if (!tweet) responseUtils.throwError("TWEET_NOT_FOUND");

    const existingSummary = await prisma.tweetSummary.findUnique({
      where: { tweetId },
      select: { summary: true },
    });

    if (existingSummary) return existingSummary;

    const summary = await generateTweetSumamry(tweet!.content);
    await prisma.tweetSummary.create({ data: { tweetId, summary } });

    return {
      summary: summary,
    };
  }

  async getUserTweets(dto: TweetCursorServiceDTO, currentUserId: string) {
    const tweets = await prisma.tweet.findMany({
      where: {
        userId: dto.userId,
        ...(dto.tweetType && { tweetType: dto.tweetType }),
      },
      select: tweetSelectFields(currentUserId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });

    const normalizedTweets = await this.normalizeTweetsAndRetweets(
      dto,
      currentUserId,
      tweets
    );

    const { cursor, paginatedRecords } = updateCursor(
      normalizedTweets,
      dto.limit,
      (record) => ({ id: record.id, createdAt: record.createdAt })
    );
    const data = this.checkUserInteractions(paginatedRecords);
    return {
      data,
      cursor,
    };
  }

  async getUserMedias(dto: TweetCursorServiceDTO) {
    const tweetsWithMedia = await prisma.tweet.findMany({
      where: {
        userId: dto.userId,
        ...(dto.tweetType && { tweetType: dto.tweetType }),
        tweetMedia: { some: {} },
      },
      select: {
        id: true,
        createdAt: true,
        tweetMedia: {
          select: {
            media: { select: mediaSelectFields() },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });

    const { cursor, paginatedRecords } = updateCursor(
      tweetsWithMedia,
      dto.limit,
      (record) => ({ id: record.id, createdAt: record.createdAt })
    );

    return {
      data: paginatedRecords,
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
      select: tweetSelectFields(dto.userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });

    const { cursor, paginatedRecords } = updateCursor(
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
    const tweetExists = await tx.tweet.findUnique({ where: { id } });
    if (!tweetExists) {
      console.warn(`Tweet ${id} not found, skipping categorization`);
      return;
    }
    const categories = await generateTweetCategory(tweetContent);
    const categoryRecords = await tx.category.findMany({
      where: {
        name: { in: categories },
      },
      select: { id: true },
    });

    if (categoryRecords.length === 0) return;

    await tx.tweetCategory.createMany({
      data: categoryRecords.map((cat) => ({
        tweetId: id,
        categoryId: cat.id,
      })),
      skipDuplicates: true,
    });
  }

  async searchTweets(dto: SearchServiceDTO) {
    const parsedDTO = SearchServiceSchema.parse(dto);

    const wherePrismaFilter = this.generateFilter(
      parsedDTO.query,
      parsedDTO.userId,
      parsedDTO.peopleFilter
    );

    const searchParams = {
      where: wherePrismaFilter,
      userId: dto.userId,
      query: dto.query,
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

  private async searchLatestTweets(dto: SearchParams) {
    const tweets = await prisma.$queryRaw<any[]>`
    SELECT 
      t.id,
      ts_rank_cd(
        to_tsvector('english', t.content),
        plainto_tsquery('english', ${dto.query})
      ) as relevance
    FROM tweets t
    WHERE to_tsvector('english', t.content) @@ plainto_tsquery('english', ${
      dto.query
    })
    ORDER BY relevance DESC, t."createdAt" DESC, t.id DESC
    LIMIT ${dto.limit + 1}
    ${dto.cursor ? Prisma.sql`OFFSET 1` : Prisma.empty}
  `;

    const tweetIds = tweets.slice(0, dto.limit).map((t) => t.id);

    const fullTweets = await prisma.tweet.findMany({
      where: { id: { in: tweetIds } },
      select: tweetSelectFields(dto.userId),
    });

    const tweetMap = new Map(fullTweets.map((t) => [t.id, t]));

    const orderedTweets = tweetIds
      .map((id) => tweetMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    const { cursor, paginatedRecords } = updateCursor(
      orderedTweets,
      dto.limit,
      (record) => ({ id: record.id })
    );

    const data = this.checkUserInteractions(paginatedRecords);

    return { data, cursor };
  }

  private async searchTopTweets(dto: SearchParams) {
    const tweets = await prisma.$queryRaw<any[]>`
    SELECT 
      t.*,
      ts_rank_cd(to_tsvector('english', t.content), plainto_tsquery('english', ${
        dto.query
      })) as relevance
    FROM tweets t
    WHERE to_tsvector('english', t.content) @@ plainto_tsquery('english', ${
      dto.query
    })
    ORDER BY relevance DESC, t.score DESC, t."createdAt" DESC, t.id DESC
    LIMIT ${dto.limit + 1}
    ${dto.cursor ? Prisma.sql`OFFSET 1` : Prisma.empty}
  `;

    const tweetIds = tweets.slice(0, dto.limit).map((t) => t.id);
    const fullTweets = await prisma.tweet.findMany({
      where: { id: { in: tweetIds } },
      select: tweetSelectFields(dto.userId),
    });
    const tweetMap = new Map(fullTweets.map((t) => [t.id, t]));

    const orderedTweets = tweetIds
      .map((id) => tweetMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    const { cursor, paginatedRecords } = updateCursor(
      orderedTweets,
      dto.limit,
      (record) => ({ id: record.id })
    );

    const data = this.checkUserInteractions(paginatedRecords);

    return { data, cursor };
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
}

const tweetService = new TweetService();
export default tweetService;
