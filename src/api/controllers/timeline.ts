import { Request, Response, NextFunction } from "express";
import { TimelineService } from "@/application/services/timeline";
import { CursorDTOSchema } from "../../application/dtos/timeline/timeline.dto.schema";

const svc = new TimelineService();

export class TimelineController {
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      // const userId = "11122384-f064-44ec-8036-c60c539dfc53"; // "Jeffrey Reichert"
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
      // const userId = (req as any).user?.id;
      // if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const userId = "11122384-f064-44ec-8036-c60c539dfc53"; // "Jeffrey Reichert"

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
