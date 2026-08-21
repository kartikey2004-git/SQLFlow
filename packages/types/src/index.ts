// Shared DTOs between apps/api and apps/web.
// These mirror the Postgres schema (apps/api/migrations) but are the
// wire-shape (camelCase, string dates) returned by the API - not the
// row shape used internally by repositories.

export type UserRole = "student" | "instructor" | "admin";

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface Column {
  columnName: string;
  dataType: string;
}

export interface SampleTable {
  tableName: string;
  columns: Column[];
  rows: Record<string, unknown>[];
}

/** Assignment list item - no schema/solution payload. */
export interface AssignmentSummary {
  id: number;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  createdAt: string;
}

/**
 * Full assignment detail served to students.
 * Intentionally excludes `solutionSql` and any hidden test case's
 * `expectedOutput` - those never leave the server.
 */
export interface AssignmentDetail extends AssignmentSummary {
  question: string;
  sampleTables: SampleTable[];
  testCases: VisibleTestCase[];
}

export type ExpectedOutputType = "table" | "single_value" | "column" | "row" | "count";

export interface VisibleTestCase {
  id: number;
  name: string | null;
  isHidden: boolean;
  /** Only present when isHidden is false. */
  expectedOutput?: { type: ExpectedOutputType; value: unknown };
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface EvaluationResultDTO {
  testCaseId: number;
  isHidden: boolean;
  passed: boolean;
  reason?: string | null;
}

export interface GradingResult {
  submissionId: number;
  passed: boolean;
  score: number;
  executionTime: number;
  rowCount: number;
  results: EvaluationResultDTO[];
}

/** Progress on a single assignment (apps/api ProgressService.ProgressData). */
export interface ProgressData {
  lastQuery: string;
  attemptCount: number;
  isCompleted: boolean;
  completedAt: string | null;
  lastAttemptAt: string;
}

export type HintLevel = 1 | 2 | 3 | 4;

export interface HintResponse {
  hintLevel: HintLevel;
  hintText: string;
  conceptTag: string | null;
  requestsRemaining: number;
}

export type JobState = "created" | "retry" | "active" | "completed" | "cancelled" | "failed";

export interface JobError {
  type: string;
  message: string;
  statusCode: number;
}

/** Output of a sandbox_jobs job - exactly one of `error`/`result` is set once state is 'completed'. */
export interface JobOutput {
  error?: JobError;
  result?: QueryResult | GradingResult;
}

export interface JobStatus {
  jobId: string;
  state: JobState;
  output: JobOutput | null;
}

/** Envelope every API response is wrapped in (apps/api ApiResponse class). */
export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  errors?: unknown[];
}
