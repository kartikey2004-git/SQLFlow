import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { JobService } from "../services/sandbox/job.service";
import type { GradeSubmissionRequest } from "@sql-learn/validation";

export const gradeSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId, query } = req.body as GradeSubmissionRequest;

    const jobId = await JobService.submit({
      type: "evaluate_submission",
      userId: req.user!.id,
      assignmentId,
      query,
    });

    res.status(202).json(new ApiResponse(202, { jobId }, "Submission queued for grading"));
  } catch (error) {
    next(error);
  }
};
