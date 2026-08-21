import { Router } from "express";
import { hintController } from "../controllers/hint.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { hintRateLimiter } from "../middleware/rateLimit.middleware";
import { HintRequestSchema } from "@sql-learn/validation";

const router = Router();

router.use(requireAuth);

router.post("/", hintRateLimiter, validateBody(HintRequestSchema), hintController.getHint);
router.get("/history", hintController.getHintHistory);

export default router;
