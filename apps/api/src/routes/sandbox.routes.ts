import { Router } from "express";
import { SandboxController } from "../controllers/sandbox.controller";
import { executionController } from "../controllers/execution.controller";
import { gradeSubmission } from "../controllers/grading.controller";
import { jobController } from "../controllers/job.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { executeRateLimiter, gradeRateLimiter } from "../middleware/rateLimit.middleware";
import { AssignmentIdBodySchema, ExecuteQuerySchema, GradeSubmissionSchema } from "@sql-learn/validation";

const router = Router();

router.use(requireAuth);
router.post("/init", validateBody(AssignmentIdBodySchema), SandboxController.initSandbox);
router.post(
  "/execute",
  executeRateLimiter,
  validateBody(ExecuteQuerySchema),
  executionController.executeQuery,
);
router.post("/grade", gradeRateLimiter, validateBody(GradeSubmissionSchema), gradeSubmission);
router.get("/jobs/:jobId", jobController.getJobStatus);
router.get("/jobs/:jobId/stream", jobController.streamJobStatus);

export default router;
