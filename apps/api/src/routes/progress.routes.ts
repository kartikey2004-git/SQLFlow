import { Router } from "express";
import { progressController } from "../controllers/progress.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/all", progressController.getAllProgress);
router.get("/:assignmentId", progressController.getProgress);
router.put("/:assignmentId", progressController.updateProgress);

export default router;
