export type SandboxJobType = "execute_query" | "evaluate_submission";

export interface SandboxJobPayload {
  type: SandboxJobType;
  userId: number;
  assignmentId: number;
  query: string;
}

export interface SandboxJobError {
  type: string;
  message: string;
  statusCode: number;
}

export interface SandboxJobOutput {
  error?: SandboxJobError;
  result?: unknown;
}
