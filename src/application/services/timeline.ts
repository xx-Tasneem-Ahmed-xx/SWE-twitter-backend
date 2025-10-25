import { prisma } from "@/prisma/client";
import { AppError } from "@/errors/AppError";
import { TimelineServiceDTO } from "@/application/dtos/tweets/service/tweets.dto";

export class TimelineService {
  async getTimeline(dto: TimelineServiceDTO) {
    const followers = await prisma.follow.findMany({
      where: { followerId: dto.userId },
      select: { followingId: true },
    });

    const followersId = followers.map((follower) => follower.followingId);

    const muted = await prisma.mute.findMany({
      where: { muterId: dto.userId },
      select: { mutedId: true },
    });

    const mutedIds = muted.map((user) => user.mutedId);

    const timline = await prisma.tweet.findMany({
      where: {
        AND: [
          { userId: { in: [...followersId, dto.userId] } },
          { userId: { notIn: mutedIds } },
        ],
      },
      include: {
        retweets: {
          where: { userId: { in: [...followersId, dto.userId] } },
          select: {
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
      orderBy: { createdAt: "desc" },
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: { id: dto.cursor }, skip: 1 }),
    });

    const hasNextPage = timline.length > dto.limit;
    const paginatedTweets = hasNextPage ? timline.slice(0, -1) : timline;
    return {
      data: paginatedTweets,
      nextCursor: hasNextPage
        ? paginatedTweets[paginatedTweets.length - 1].id
        : null,
    };
  }
}
