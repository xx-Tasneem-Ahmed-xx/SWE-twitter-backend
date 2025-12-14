import { Router } from "express";
import { ExploreController } from "@/api/controllers/explore";

const router = Router();
const exploreController = new ExploreController();

router.route("/categories").get(exploreController.getCategories);

router
.route("/preferred-categories")
.get(exploreController.getUserPreferredCategories)
.post(exploreController.saveUserPreferredCategories);

router.route("/").get(exploreController.getFeed);

export default router;
