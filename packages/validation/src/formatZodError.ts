import type { ZodError } from "zod";

export interface FieldError {
  field: string;
  message: string;
}

export const formatZodError = (error: ZodError): FieldError[] =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
