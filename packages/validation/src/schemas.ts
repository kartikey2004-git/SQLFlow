import { z } from "zod";

const positiveIntId = z.coerce
  .number("A valid assignmentId is required")
  .int("A valid assignmentId is required")
  .positive("A valid assignmentId is required");

export const AssignmentIdBodySchema = z.object({
  assignmentId: positiveIntId,
});
export type AssignmentIdBody = z.infer<typeof AssignmentIdBodySchema>;

export const ExecuteQuerySchema = z.object({
  assignmentId: positiveIntId,
  query: z.string().min(1, "Invalid or missing query"),
});
export type ExecuteQueryRequest = z.infer<typeof ExecuteQuerySchema>;

export const GradeSubmissionSchema = z.object({
  assignmentId: positiveIntId,
  query: z.string().min(1, "Query is required"),
});
export type GradeSubmissionRequest = z.infer<typeof GradeSubmissionSchema>;

export const HintRequestSchema = z.object({
  assignmentId: positiveIntId,
  userQuery: z.string(),
});
export type HintRequest = z.infer<typeof HintRequestSchema>;

// Not wired into a rejecting middleware anywhere - progress updates are
// intentionally permissive today (coerced with Boolean(), never 400s).
// Kept here only so the shape is documented alongside the other schemas.
export const ProgressUpdateSchema = z.object({
  lastQuery: z.string().nullish(),
  incrementAttempt: z.unknown().optional(),
  markCompleted: z.unknown().optional(),
});
export type ProgressUpdateRequest = z.infer<typeof ProgressUpdateSchema>;
