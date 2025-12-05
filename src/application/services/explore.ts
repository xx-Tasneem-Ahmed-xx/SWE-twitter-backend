import { prisma } from "@/prisma/client";
import {
  CategoryCursorDTO,
  PreferredCategorieDTO,
} from "@/application/dtos/explore/explore.dto";
import { updateCursor } from "../utils/tweet.utils";

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
}
