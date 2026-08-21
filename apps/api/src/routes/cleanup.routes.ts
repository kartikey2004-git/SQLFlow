import { Router } from "express";
import { cleanupController } from "../controllers/cleanup.controller";

const router = Router();

// These endpoints require special authorization header
router.post("/perform", cleanupController.performCleanup);
router.get("/stats", cleanupController.getCleanupStats);

export default router;
