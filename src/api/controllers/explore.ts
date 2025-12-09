import { Request, Response, NextFunction } from "express";
import {
  CategoryCursorSchema,
  ExploreServiceSchema,
  PreferredCategoriesSchema,
} from "@/application/dtos/explore/explore.dto.schema";
import { encoderService } from "@/application/services/encoder";
import { ExploreService } from "@/application/services/explore";
import * as responseUtils from "@/application/utils/response.utils";

export class ExploreController {
  private readonly exploreService: ExploreService;

  constructor() {
    this.exploreService = ExploreService.getInstance();
  }

  public getCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const decodedCursor = encoderService.decode<{
        id: string;
      }>(req.query.cursor as string);

      const parsedDTO = CategoryCursorSchema.parse({
        limit: req.query.limit,
        cursor: decodedCursor ?? undefined,
      });

      const categories = await this.exploreService.getCategories(parsedDTO);

      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  };

  public saveUserPreferredCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user.id;
      const parsedPayload = PreferredCategoriesSchema.parse(req.body);

      await this.exploreService.saveUserPreferredCategories(
        userId,
        parsedPayload
      );
      return responseUtils.sendResponse(res, "CATEGORIES_SAVED");
    } catch (error) {
      next(error);
    }
  };

  public getFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query;
      const userId = (req as any).user.id;
      const decodedCursor = encoderService.decode<number>(
        query.cursor as string
      );

      const parsedDTO = ExploreServiceSchema.parse({
        userId,
        limit: query.limit,
        cursor: decodedCursor ?? undefined,
        category: query.category ? String(query.category) : undefined,
      });
      const feed = await this.exploreService.getFeed(parsedDTO);
      res.status(200).json(feed);
    } catch (error) {
      next(error);
    }
  };
}
