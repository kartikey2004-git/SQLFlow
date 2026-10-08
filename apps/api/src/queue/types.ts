import type { QueryResult, GradingResult, SandboxProvisionResult } from "@sql-learn/types";

export type SandboxJobType = "execute_query" | "evaluate_submission" | "init_sandbox" | "reset_sandbox";

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
  result?: QueryResult | GradingResult | SandboxProvisionResult;
}

export interface MaintenanceJobPayload {
  daysToKeep: number;
}
