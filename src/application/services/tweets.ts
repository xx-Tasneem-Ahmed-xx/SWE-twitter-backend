import { prisma, TweetType } from "@/prisma/client";
import {
  validToRetweetOrQuote,
  validToReply,
} from "@/application/utils/tweets/utils";
import {
  CreateReplyOrQuoteServiceDTO,
  CreateReTweetServiceDto,
  CreateTweetServiceDto,
} from "../dtos/tweets/service/tweets.dto";

export class TweetService {
  async createTweet(dto: CreateTweetServiceDto) {
    return prisma.tweet.create({
      data: { ...dto, tweetType: TweetType.TWEET },
    });
  }

  async createQuote(dto: CreateReplyOrQuoteServiceDTO) {
    const valid = await validToRetweetOrQuote(dto.parentId);
    if (valid)
      return prisma.$transaction([
        prisma.tweet.create({
          data: { ...dto, tweetType: TweetType.QUOTE },
        }),
        prisma.tweet.update({
          where: { id: dto.parentId },
          data: { quotesCount: { increment: 1 } },
        }),
      ]);
    else throw new Error("You cannot quote a protected tweet");
  }

  async createReply(dto: CreateReplyOrQuoteServiceDTO) {
    const valid = await validToReply(dto.parentId, dto.userId);
    if (valid)
      return prisma.$transaction([
        prisma.tweet.create({
          data: { ...dto, tweetType: TweetType.REPLY },
        }),
        prisma.tweet.update({
          where: { id: dto.parentId },
          data: { repliesCount: { increment: 1 } },
        }),
      ]);
    else throw new Error("You cannot reply to this tweet");
  }

  async createRetweet(dto: CreateReTweetServiceDto) {
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
    else throw new Error("You cannot retweet a protected tweet");
  }

  async getTweet(id: string) {
    return prisma.tweet.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true,
            verified: true,
          },
        },
      },
    });
  }

  async updateTweet(id: string, content: string) {
    return prisma.tweet.update({ where: { id }, data: { content } });
  }

  async deleteTweet(id: string) {
    const tweet = await prisma.tweet.findUnique({
      where: { id },
      select: { parentId: true, tweetType: true },
    });

    if (!tweet) throw new Error("Tweet not found");

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
                profilePhoto: true,
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
            profilePhoto: true,
            verified: true,
            protectedAccount: true,
          },
        },
      },
    });
  }
}
