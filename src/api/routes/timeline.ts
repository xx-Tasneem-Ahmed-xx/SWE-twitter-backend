import { Router } from "express";
import { TimelineController } from "@/api/controllers/timeline";

const router = Router();
const timelineController = new TimelineController();

router.route("/timeline").get(timelineController.getTimeline);

export default router;
