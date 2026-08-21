import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { JobService } from "../services/sandbox/job.service";
import type { ExecuteQueryRequest } from "@sql-learn/validation";

export class ExecutionController {
  executeQuery = asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId, query } = req.body as ExecuteQueryRequest;

    const jobId = await JobService.submit({
      type: "execute_query",
      userId: req.user!.id,
      assignmentId,
      query,
    });

    res.status(202).json(new ApiResponse(202, { jobId }, "Query queued for execution"));
  });
}

export const executionController = new ExecutionController();
