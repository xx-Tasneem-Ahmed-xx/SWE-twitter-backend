// src/api/routes/timeline.ts
import { Router } from "express";
import { timelineController } from "@/api/controllers/timeline";

const router = Router();
router.get(
  "/timeline",
  timelineController.getTimeline.bind(timelineController)
);
router.get(
  "/for-you",
  timelineController.getForYou.bind(timelineController)
);

export default router;
