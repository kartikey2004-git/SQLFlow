import { Router } from "express";
import { SandboxController } from "../controllers/sandbox.controller";
import { executionController } from "../controllers/execution.controller";
import { gradeSubmission } from "../controllers/grading.controller";
import { jobController } from "../controllers/job.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { executeRateLimiter, gradeRateLimiter, jobReadRateLimiter, sandboxLifecycleRateLimiter } from "../middleware/rateLimit.middleware";
import { AssignmentIdBodySchema, ExecuteQuerySchema, GradeSubmissionSchema } from "@sql-learn/validation";

const router = Router();

router.use(requireAuth);
router.post("/init", sandboxLifecycleRateLimiter, validateBody(AssignmentIdBodySchema), SandboxController.initSandbox);
router.post(
  "/reset",
  sandboxLifecycleRateLimiter,
  validateBody(AssignmentIdBodySchema),
  SandboxController.resetSandbox,
);
router.post(
  "/execute",
  executeRateLimiter,
  validateBody(ExecuteQuerySchema),
  executionController.executeQuery,
);
router.post("/grade", gradeRateLimiter, validateBody(GradeSubmissionSchema), gradeSubmission);
router.get("/jobs/:jobId", jobReadRateLimiter, jobController.getJobStatus);
router.get("/jobs/:jobId/stream", jobReadRateLimiter, jobController.streamJobStatus);

export default router;
