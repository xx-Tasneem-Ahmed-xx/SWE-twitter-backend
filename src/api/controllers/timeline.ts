import { TimelineSchema } from "@/application/dtos/tweets/tweet.dto.schema";
import { TimelineService } from "@/application/services/timeline";
import { Response, Request, NextFunction } from "express";
import {
  TimelineQuerySchema,
  ForYouQuerySchema,
} from "@/application/dtos/timeline/timeline.dto.schema";

const timelineService = new TimelineService();

export class TimelineController {
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const parsedPayload = TimelineSchema.parse({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        cursor: req.query.cursor,
      });

      const timeline = await timelineService.getTimeline({
        userId,
        ...parsedPayload,
      });
      res.status(200).json(timeline);
    } catch (error) {
      next(error);
    }
  }

  async getForYou(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const parsed = ForYouQuerySchema.parse({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        cursor: req.query.cursor,
      });

      const feed = await timelineService.getForYou({
        userId,
        ...parsed,
      });

      res.status(200).json(feed);
    } catch (error) {
      next(error);
    }
  }
}
export default new TimelineController();
