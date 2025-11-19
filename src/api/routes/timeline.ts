import { Router } from "express";
import TimelineController from "@/api/controllers/timeline";

const router = Router();

router.get(
  "/timeline",
  TimelineController.getTimeline.bind(TimelineController)
);
router.get(
  "/for-you",
  TimelineController.getForYou.bind(TimelineController)
);

export default router;
