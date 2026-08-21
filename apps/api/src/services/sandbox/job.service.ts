import { getBoss, SANDBOX_QUEUE } from "../../queue/boss";
import type { SandboxJobPayload, SandboxJobOutput } from "../../queue/types";
import { ApiError } from "../../utils/ApiError";

export interface JobStatusDTO {
  jobId: string;
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  output: SandboxJobOutput | null;
}

export const JobService = {
  async submit(payload: SandboxJobPayload): Promise<string> {
    const boss = await getBoss();
    const jobId = await boss.send(SANDBOX_QUEUE, payload, {
      singletonKey: `user:${payload.userId}`,
    });
    if (!jobId) {
      throw new ApiError(429, "You already have a query or submission in progress - wait for it to finish");
    }
    return jobId;
  },

  async getStatus(jobId: string): Promise<JobStatusDTO | null> {
    const boss = await getBoss();
    const job = await boss.getJobById<SandboxJobPayload>(SANDBOX_QUEUE, jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      state: job.state,
      output: (job.output as SandboxJobOutput) ?? null,
    };
  },
};
