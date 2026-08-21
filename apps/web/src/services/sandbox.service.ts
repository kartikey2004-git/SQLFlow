import type { QueryResult, GradingResult, JobStatus } from "@sql-learn/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result: ApiEnvelope<T> = await response.json();
  if (!result.success) {
    throw new Error(result.message || "Request failed");
  }
  return result.data;
};

export const initSandbox = (assignmentId: number): Promise<{ schemaName: string; isNew: boolean }> =>
  request("/sandbox/init", { method: "POST", body: JSON.stringify({ assignmentId }) });

const submitJob = (path: string, assignmentId: number, query: string): Promise<{ jobId: string }> =>
  request(path, { method: "POST", body: JSON.stringify({ assignmentId, query }) });

/**
 * Subscribes to a queued job's status via SSE (GET /sandbox/jobs/:id/stream),
 * resolving once it reaches a terminal state. Falls back to polling
 * GET /sandbox/jobs/:id if EventSource isn't available (e.g. very old
 * browsers) or the stream errors out before a terminal state is reached.
 */
const waitForJob = (jobId: string, onStatus?: (status: JobStatus) => void): Promise<JobStatus> => {
  const terminal = new Set(["completed", "cancelled", "failed"]);

  if (typeof EventSource === "undefined") {
    return pollForJob(jobId, onStatus);
  }

  return new Promise((resolve, reject) => {
    const source = new EventSource(`${API_URL}/sandbox/jobs/${jobId}/stream`, { withCredentials: true });
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      source.close();
      fn();
    };

    source.addEventListener("status", (event) => {
      const status: JobStatus = JSON.parse((event as MessageEvent).data);
      onStatus?.(status);
      if (terminal.has(status.state)) {
        finish(() => resolve(status));
      }
    });

    source.addEventListener("error", () => {
      // The stream itself failed (network blip, proxy buffering, etc.) -
      // the job may still be running server-side, so fall back to polling
      // rather than surfacing a spurious failure.
      finish(() => pollForJob(jobId, onStatus).then(resolve, reject));
    });
  });
};

const pollForJob = async (jobId: string, onStatus?: (status: JobStatus) => void): Promise<JobStatus> => {
  const terminal = new Set(["completed", "cancelled", "failed"]);
  for (let i = 0; i < 40; i++) {
    const status = await request<JobStatus>(`/sandbox/jobs/${jobId}`);
    onStatus?.(status);
    if (terminal.has(status.state)) return status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for job to finish");
};

const jobResult = <T>(status: JobStatus): T => {
  if (status.state !== "completed") {
    throw new Error(`Job did not complete (state: ${status.state})`);
  }
  if (status.output?.error) {
    throw new Error(status.output.error.message);
  }
  return status.output?.result as T;
};

export const executeQuery = async (
  assignmentId: number,
  query: string,
  onStatus?: (status: JobStatus) => void,
): Promise<QueryResult> => {
  const { jobId } = await submitJob("/sandbox/execute", assignmentId, query);
  const status = await waitForJob(jobId, onStatus);
  return jobResult<QueryResult>(status);
};

export const gradeSubmission = async (
  assignmentId: number,
  query: string,
  onStatus?: (status: JobStatus) => void,
): Promise<GradingResult> => {
  const { jobId } = await submitJob("/sandbox/grade", assignmentId, query);
  const status = await waitForJob(jobId, onStatus);
  return jobResult<GradingResult>(status);
};

export type { QueryResult, GradingResult, JobStatus };
