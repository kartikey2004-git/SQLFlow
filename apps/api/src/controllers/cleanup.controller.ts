import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { CleanupService } from "../services/cleanup/cleanup.service";

const requireCleanupAuth = (req: Request): void => {
  const provided = req.headers["x-cleanup-authorization"];
  const expected = process.env.CLEANUP_TOKEN!;

  const providedBuf = Buffer.from(typeof provided === "string" ? provided : "");
  const expectedBuf = Buffer.from(expected);

  const isAuthorized =
    providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

  if (!isAuthorized) {
    throw new ApiError(403, "Unauthorized: cleanup requires special authorization");
  }
};

export class CleanupController {
  performCleanup = asyncHandler(async (req: Request, res: Response) => {
    requireCleanupAuth(req);

    const days = Math.max(1, Math.min(30, parseInt(req.body?.daysToKeep, 10) || 7));
    const result = await CleanupService.performFullCleanup(days);

    res.status(200).json(new ApiResponse(200, result, "Cleanup completed successfully"));
  });

  getCleanupStats = asyncHandler(async (req: Request, res: Response) => {
    requireCleanupAuth(req);

    const stats = await CleanupService.getCleanupStats();
    res.status(200).json(new ApiResponse(200, stats, "Cleanup stats retrieved successfully"));
  });
}

export const cleanupController = new CleanupController();
