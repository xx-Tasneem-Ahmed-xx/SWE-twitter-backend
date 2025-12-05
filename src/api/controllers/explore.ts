import {
  CategoryCursorSchema,
  PreferredCategoriesSchema,
} from "@/application/dtos/explore/explore.dto.schema";
import { encoderService } from "@/application/services/encoder";
import { ExploreService } from "@/application/services/explore";
import { Request, Response, NextFunction } from "express";

export class ExploreController {
  private exploreService: ExploreService;

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
      return res.status(200).json("Preferred categories saved successfully!");
    } catch (error) {
      next(error);
    }
  };

  public getExploreFeed = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user.id;
    } catch (error) {
      next(error);
    }
  };
}
