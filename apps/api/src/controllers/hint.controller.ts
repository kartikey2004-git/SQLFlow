import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { HintService } from "../services/hints/hint.service";
import { AttemptRepository } from "../repositories/attempt.repository";
import type { HintRequest } from "@sql-learn/validation";

export class HintController {
  getHint = asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId, userQuery } = req.body as HintRequest;

    const attempt = await AttemptRepository.findByUserAndAssignment(req.user!.id, assignmentId);
    const hintResponse = await HintService.getHint(req.user!.id, assignmentId, userQuery, attempt?.id ?? null);

    res.status(200).json(new ApiResponse(200, hintResponse, "Hint generated successfully"));
  });

  getHintHistory = asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.query.assignmentId ? Number(req.query.assignmentId) : undefined;
    const hintHistory = await HintService.getHintHistory(req.user!.id, assignmentId);

    res.status(200).json(new ApiResponse(200, hintHistory, "Hint history fetched successfully"));
  });
}

export const hintController = new HintController();
