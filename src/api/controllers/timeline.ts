import { Request, Response, NextFunction } from "express";
import * as responseUtils from "@/application/utils/response.utils";
import { TimelineService } from "@/application/services/timeline";
import { CursorDTOSchema } from "../../application/dtos/timeline/timeline.dto.schema";

const svc = new TimelineService();

export class TimelineController {
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      //TODO: WHEN LOGIN WORKS
      const userId = (req as any).user?.id;
      if (!userId) responseUtils.throwError("UNAUTHORIZED_USER");
      // const userId = "00505325-856b-4569-9529-210a1b255989"; // "Jerry Donnelly"
      const parsed = CursorDTOSchema.parse({
        cursor: req.query.cursor,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      const result = await svc.getTimeline({ userId, ...parsed });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getForYou(req: Request, res: Response, next: NextFunction) {
    try {
      //TODO: WHEN LOGIN WORKS
      const userId = (req as any).user?.id;
      if (!userId) responseUtils.throwError("UNAUTHORIZED_USER");
      // const userId = "00505325-856b-4569-9529-210a1b255989"; // "Charlotte Kuvalis II"

      const parsed = CursorDTOSchema.parse({
        cursor: req.query.cursor,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      const feed = await svc.getForYou({ userId, ...parsed });
      return res.status(200).json(feed);
    } catch (err) {
      next(err);
    }
  }
}

export const timelineController = new TimelineController();
