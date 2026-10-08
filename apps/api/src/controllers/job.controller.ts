import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../utils/logger";
import { registerStream } from "../utils/sseRegistry";
import { getBoss, SANDBOX_QUEUE } from "../queue/boss";
import type { SandboxJobOutput, SandboxJobPayload } from "../queue/types";
import type { JobStatusDTO } from "../services/sandbox/job.service";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed"]);

const POLL_INTERVAL_MS = 500;
const MAX_STREAM_MS = 20_000;
const HEARTBEAT_MS = 10_000;

const getOwnedStatus = async (jobId: string, userId: number): Promise<JobStatusDTO | null> => {
  const boss = await getBoss();
  const job = await boss.getJobById<SandboxJobPayload>(SANDBOX_QUEUE, jobId);
  if (!job || job.data?.userId !== userId) return null;
  return { jobId: job.id, state: job.state, output: (job.output as SandboxJobOutput) ?? null };
};

const paramJobId = (req: Request): string | undefined =>
  Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

export class JobController {
  getJobStatus = asyncHandler(async (req: Request, res: Response) => {
    const jobId = paramJobId(req);
    if (!jobId) {
      throw new ApiError(400, "jobId is required");
    }

    const status = await getOwnedStatus(jobId, req.user!.id);
    if (!status) {
      throw new ApiError(404, "Job not found");
    }

    res.status(200).json(new ApiResponse(200, status, "Job status fetched"));
  });

  streamJobStatus = asyncHandler(async (req: Request, res: Response) => {
    const jobId = paramJobId(req);
    if (!jobId) {
      throw new ApiError(400, "jobId is required");
    }
    const userId = req.user!.id;

    let status = await getOwnedStatus(jobId, userId);
    if (!status) {
      throw new ApiError(404, "Job not found");
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    registerStream(res);

    let eventId = 0;
    let closed = false;
    const start = Date.now();

    const send = (event: string, data: unknown) => {
      eventId += 1;
      res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      if (!closed) res.write(": ping\n\n");
    }, HEARTBEAT_MS);

    const onClose = () => {
      closed = true;
      clearInterval(heartbeat);
    };
    req.on("close", onClose);
    res.on("close", onClose);

    try {
      while (!closed) {
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
        if (closed) break;
        status = await getOwnedStatus(jobId, userId);
      }
    } catch (err) {
      if (!closed) send("error", { message: "Internal error" });
      logger.error({ err }, "SSE stream failed");
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });
}

export const jobController = new JobController();
