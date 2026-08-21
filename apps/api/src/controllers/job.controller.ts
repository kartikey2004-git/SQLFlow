import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { JobService } from "../services/sandbox/job.service";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed"]);
const POLL_INTERVAL_MS = 300;
const MAX_STREAM_MS = 20_000;

export class JobController {
  getJobStatus = asyncHandler(async (req: Request, res: Response) => {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    if (!jobId) {
      throw new ApiError(400, "jobId is required");
    }

    const status = await JobService.getStatus(jobId);
    if (!status) {
      throw new ApiError(404, "Job not found");
    }

    res.status(200).json(new ApiResponse(200, status, "Job status fetched"));
  });

  /**
   * SSE stream of job status. Backed by polling the pg-boss job row (not
   * LISTEN/NOTIFY) - simple and sufficient given jobs here finish in low
   * single-digit seconds; monotonic event IDs let a reconnecting client
   * (`Last-Event-ID`) resume without double-applying a stale event.
   */
  streamJobStatus = async (req: Request, res: Response) => {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    if (!jobId) {
      res.status(400).end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let eventId = 0;
    let closed = false;
    const start = Date.now();

    const send = (event: string, data: unknown) => {
      eventId += 1;
      res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    req.on("close", () => {
      closed = true;
    });

    while (!closed) {
      const status = await JobService.getStatus(jobId);
      if (!status) {
        send("error", { message: "Job not found" });
        break;
      }

      send("status", status);

      if (TERMINAL_STATES.has(status.state)) {
        break;
      }
      if (Date.now() - start > MAX_STREAM_MS) {
        send("error", { message: "Timed out waiting for job to finish - poll GET /sandbox/jobs/:jobId instead" });
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!closed) {
      res.end();
    }
  };
}

export const jobController = new JobController();
