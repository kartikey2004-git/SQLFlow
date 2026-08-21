import type { ZodError } from "zod";

export interface FieldError {
  field: string;
  message: string;
}

/** Maps zod issues into the {field, message}[] shape ApiError's constructor already accepts. */
export const formatZodError = (error: ZodError): FieldError[] =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
