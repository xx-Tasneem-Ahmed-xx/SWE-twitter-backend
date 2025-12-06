import { prisma } from "@/prisma/client";
import {
  CategoryCursorDTO,
  ExploreServiceDTO,
  PreferredCategorieDTO,
} from "@/application/dtos/explore/explore.dto";
import { updateCursor } from "@/application/utils/tweet.utils";
import tweetService from "@/application/services/tweets";
import { PreferredCategoriesSchema } from "../dtos/explore/explore.dto.schema";

export class ExploreService {
  private static instance: ExploreService;
  private constructor() {}
  public static getInstance(): ExploreService {
    if (!ExploreService.instance) {
      ExploreService.instance = new ExploreService();
    }
    return ExploreService.instance;
  }

  async getCategories(dto: CategoryCursorDTO) {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "desc" },
      take: dto.limit + 1,
      ...(dto.cursor && { cursor: dto.cursor, skip: 1 }),
    });
    const { cursor, paginatedRecords } = updateCursor(
      categories,
      dto.limit,
      (record) => ({ id: record.id })
    );
    return {
      data: paginatedRecords,
      cursor,
    };
  }

  async saveUserPreferredCategories(
    userId: string,
    dto: PreferredCategorieDTO
  ) {
    PreferredCategoriesSchema.parse(dto)
    return await prisma.user.update({
      where: { id: userId },
      data: {
        preferredCategories: {
          set: [],
          connect: dto.categoryIds.map((id) => ({ id })),
        },
      },
      select: { id: true },
    });
  }

  async getFeed(dto: ExploreServiceDTO) {
    const tweets = await prisma.tweet.findMany({
      where: {
        AND: [
          { user: { blocked: { none: { blockerId: dto.userId } } } },
          { user: { muted: { none: { muterId: dto.userId } } } },
          { notInteresteds: { none: { userId: dto.userId } } },
          { spamReports: { none: { reporterId: dto.userId } } },
        ],

        ...(dto.categoryId && {
          tweetCategories: { some: { categoryId: dto.categoryId } },
        }),
      },
      orderBy: [{ score: "desc" }, { id: "desc" }],
      take: dto.limit + 1,
      select: { ...tweetService.tweetSelectFields(dto.userId), score: true },
      ...(dto.cursor && {
        cursor: { id: dto.cursor.id },
        skip: 1,
      }),
    });

    const { cursor, paginatedRecords } = updateCursor(
      tweets,
      dto.limit,
      (record) => ({ id: record.id, score: record.score })
    );

    return {
      data: tweetService.checkUserInteractions(paginatedRecords),
      cursor,
    };
  }
}
