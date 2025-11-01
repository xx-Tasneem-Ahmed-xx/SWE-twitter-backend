import { prisma, TweetType } from "@/prisma/client";
import {
  validToRetweetOrQuote,
  validToReply,
} from "@/application/utils/tweets/utils";
import {
  CreateReplyOrQuoteServiceDTO,
  CreateReTweetServiceDto,
  CreateTweetServiceDto,
  SearchServiceDTO,
  TweetResponses,
} from "@/application/dtos/tweets/service/tweets.dto";
import { AppError } from "@/errors/AppError";
import { generateTweetSumamry } from "./aiSummary";
import { SearchServiceSchema } from "../dtos/tweets/service/tweets.dto.schema";
import { PeopleFilter, SearchTab } from "../dtos/tweets/tweet.dto.schema";
import { record } from "zod";
import { SearchParams } from "@/types/types";
import encoderService from "@/application/services/encoder";
import { attachHashtagsToTweet } from "./hashtags";

export class TweetService {
  private validateId(id: string) {
    if (!id || typeof id !== "string") {
      throw new AppError("Invalid ID", 400);
    }
  }
  async createTweet(dto: CreateTweetServiceDto) {
    return prisma.$transaction(async (tx) => {
      const tweet = await tx.tweet.create({
        data: { ...dto, tweetType: TweetType.TWEET },
      });
      // TODO: Background Job
      await attachHashtagsToTweet(tweet.id, tweet.content, tx);
      return tweet;
    });
  }

  async createQuote(dto: CreateReplyOrQuoteServiceDTO) {
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (!valid) throw new AppError("You cannot quote a protected tweet", 403);

    return prisma.$transaction(async (tx) => {
      const quote = await prisma.tweet.create({
        data: { ...dto, tweetType: TweetType.QUOTE },
      });

      await prisma.tweet.update({
        where: { id: dto.parentId },
        data: { quotesCount: { increment: 1 } },
      });
      // TODO: Background Job
      await attachHashtagsToTweet(quote.id, quote.content, tx);
      return quote;
    });
  }

  async createReply(dto: CreateReplyOrQuoteServiceDTO) {
    const valid = await validToReply(dto.parentId, dto.userId);
    if (!valid) throw new AppError("You cannot reply to this tweet", 403);

    return prisma.$transaction(async (tx) => {
      const reply = await prisma.tweet.create({
        data: { ...dto, tweetType: TweetType.REPLY },
      });

      await prisma.tweet.update({
        where: { id: dto.parentId },
        data: { repliesCount: { increment: 1 } },
      });
      // TODO: Background Job
      await attachHashtagsToTweet(reply.id, reply.content, tx);
      return reply;
    });
  }

  async createRetweet(dto: CreateReTweetServiceDto) {
    this.validateId(dto.parentId);
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (valid)
      return prisma.$transaction([
        prisma.retweet.create({
          data: { userId: dto.userId, tweetId: dto.parentId },
        }),
        prisma.tweet.update({
          where: { id: dto.parentId },
          data: { retweetCount: { increment: 1 } },
        }),
      ]);
    else throw new AppError("You cannot retweet a protected tweet", 403);
  }

  async getRetweets(tweetId: string) {
    this.validateId(tweetId);
    return prisma.retweet.findMany({
      where: { tweetId },
      select: {
        user: {
          select: {
            name: true,
            username: true,

            verified: true,
          },
        },
      },
    });
  }

  async getTweet(id: string) {
    this.validateId(id);
    return prisma.tweet.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profileMedia: { select: { id: true, keyName: true } },
            verified: true,
          },
        },
      },
    });
  }

  async updateTweet(id: string, content: string) {
    this.validateId(id);
    return prisma.tweet.update({ where: { id }, data: { content } });
  }

  async deleteTweet(id: string) {
    this.validateId(id);
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
    this.validateId(id);
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
    this.validateId(id);
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
    this.validateId(tweetId);
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

  async getLikedTweets(userId: string) {
    return prisma.tweetLike.findMany({
      where: { userId },
      select: {
        tweet: {
          include: {
            user: {
              select: {
                username: true,
                name: true,
                profileMedia: { select: { id: true, keyName: true } },
                verified: true,
                protectedAccount: true,
              },
            },
          },
        },
      },
    });
  }

  async getTweetReplies(tweetId: string) {
    return prisma.tweet.findMany({
      where: { parentId: tweetId },
      include: {
        user: {
          select: {
            username: true,
            name: true,
            profileMedia: { select: { id: true, keyName: true } },
            verified: true,
            protectedAccount: true,
          },
        },
      },
    });
  }

  async likeTweet(userId: string, tweetId: string) {
    this.validateId(tweetId);
    const tweet = await prisma.tweet.findUnique({ where: { id: tweetId } });
    if (!tweet) throw new AppError("Tweet not found", 404);

    const existingLike = await prisma.tweetLike.findUnique({
      where: { userId_tweetId: { userId, tweetId } },
    });

    if (existingLike) throw new AppError("Tweet already liked", 409);
    return prisma.$transaction([
      prisma.tweet.update({
        where: { id: tweetId },
        data: { likesCount: { increment: 1 } },
      }),
      prisma.tweetLike.create({ data: { userId, tweetId } }),
    ]);
  }

  async deleteLike(userId: string, tweetId: string) {
    this.validateId(tweetId);
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

  async getLikers(tweetId: string) {
    this.validateId(tweetId);
    return prisma.tweetLike.findMany({
      where: { tweetId },
      select: {
        user: {
          select: {
            name: true,
            username: true,
            profileMedia: { select: { id: true, keyName: true } },
            verified: true,
          },
        },
      },
    });
  }

  async getTweetSummary(tweetId: string) {
    this.validateId(tweetId);

    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { content: true },
    });

    if (!tweet) throw new AppError("Tweet not found", 404);

    const existingSummary = await prisma.tweetSummary.findUnique({
      where: { tweetId },
      select: { tweetId: true, summary: true },
    });

    if (existingSummary) return existingSummary;

    const summary = await generateTweetSumamry(tweet.content);
    await prisma.tweetSummary.create({ data: { tweetId, summary } });

    return {
      tweetId: tweetId,
      summary: summary,
    };
  }

  async searchTweets(dto: SearchServiceDTO) {
    const parsedDTO = SearchServiceSchema.parse(dto);

    const wherePrismaFilter = this.generateFilter(
      parsedDTO.query,
      parsedDTO.userId,
      parsedDTO.peopleFilter
    );

    const selectFields = this.tweetSelectFields();

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

  private tweetSelectFields() {
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
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          profileMedia: { select: { id: true, keyName: true } },
          verified: true,
          protectedAccount: true,
        },
      },
    };
  }
}
