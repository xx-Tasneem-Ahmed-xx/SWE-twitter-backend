import { TimelineSchema } from "@/application/dtos/tweets/tweet.dto.schema";
import { TimelineService } from "@/application/services/timeline";
import { Response, Request, NextFunction } from "express";

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
}
