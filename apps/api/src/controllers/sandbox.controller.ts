import type { Request, Response } from "express";
import { SandboxService } from "../services/sandbox/sandbox.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import type { AssignmentIdBody } from "@sql-learn/validation";

export class SandboxController {
  static initSandbox = asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId } = req.body as AssignmentIdBody;

    const result = await SandboxService.initSandbox(req.user!.id, assignmentId);

    res.status(200).json(
      new ApiResponse(
        200,
        { schemaName: result.schemaName, isNew: result.isNew },
        "Sandbox initialized successfully",
      ),
    );
  });
}
