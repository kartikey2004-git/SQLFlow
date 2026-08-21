import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { ProgressService } from "../services/progress/progress.service";

const parseAssignmentId = (raw: string | string[] | undefined): number => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid assignment id");
  }
  return id;
};

export class ProgressController {
  getProgress = asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseAssignmentId(req.params.assignmentId);
    const progress = await ProgressService.getOrCreateProgress(req.user!.id, assignmentId);

    res
      .status(200)
      .json(new ApiResponse(200, progress, "Progress fetched successfully"));
  });

  updateProgress = asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseAssignmentId(req.params.assignmentId);
    const { lastQuery, incrementAttempt, markCompleted } = req.body ?? {};

    const progress = await ProgressService.updateProgress(req.user!.id, assignmentId, {
      lastQuery,
      incrementAttempt: Boolean(incrementAttempt),
      markCompleted: Boolean(markCompleted),
    });

    res
      .status(200)
      .json(new ApiResponse(200, progress, "Progress updated successfully"));
  });

  getAllProgress = asyncHandler(async (req: Request, res: Response) => {
    const allProgress = await ProgressService.getAllProgress(req.user!.id);
    res
      .status(200)
      .json(new ApiResponse(200, allProgress, "All progress fetched successfully"));
  });
}

export const progressController = new ProgressController();
