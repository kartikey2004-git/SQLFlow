
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

export interface AssignmentSummary {
  id: number;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  createdAt: string;
}

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
  expectedOutput?: { type: ExpectedOutputType; value: unknown };
}

export interface StatementResult {
  index: number;
  command: string;
  rowCount: number | null;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
  error?: { message: string; code?: string; position?: number };
}

export interface QueryResult {
  statements: StatementResult[];
  executionTime: number;
  aborted: boolean;
}

export interface SandboxProvisionResult {
  sandboxReady: true;
  created: boolean;
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
  statements?: StatementResult[];
  results: EvaluationResultDTO[];
}

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

export interface JobOutput {
  error?: JobError;
  result?: QueryResult | GradingResult | SandboxProvisionResult;
}

export interface JobStatus {
  jobId: string;
  state: JobState;
  output: JobOutput | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  errors?: unknown[];
}
