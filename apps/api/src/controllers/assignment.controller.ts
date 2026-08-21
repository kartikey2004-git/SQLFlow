import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { assignmentService } from "../services/content/assignment.service";

export class AssignmentController {
  getAllAssignments = asyncHandler(async (_req: Request, res: Response) => {
    const assignments = await assignmentService.getAllAssignments();

    const response = new ApiResponse(
      200,
      assignments,
      "Assignments fetched successfully",
    );
    res.status(response.statusCode).json(response);
  });

  getAssignmentById = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!req.params.id || !Number.isInteger(id) || id <= 0) {
      throw new ApiError(400, "Invalid assignment id");
    }

    const assignment = await assignmentService.getAssignmentById(id);

    const response = new ApiResponse(
      200,
      assignment,
      "Assignment fetched successfully",
    );
    res.status(response.statusCode).json(response);
  });
}

export const assignmentController = new AssignmentController();
