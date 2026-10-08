import type { Request, Response } from "express";
import { JobService } from "../services/sandbox/job.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import type { AssignmentIdBody } from "@sql-learn/validation";

const enqueue = (type: "init_sandbox" | "reset_sandbox", message: string) =>
  asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId } = req.body as AssignmentIdBody;
    const jobId = await JobService.submit({ type, userId: req.user!.id, assignmentId, query: "" });
    res.status(202).json(new ApiResponse(202, { jobId }, message));
  });

export class SandboxController {
  static initSandbox = enqueue("init_sandbox", "Sandbox initialization queued");
  static resetSandbox = enqueue("reset_sandbox", "Sandbox reset queued");
}
