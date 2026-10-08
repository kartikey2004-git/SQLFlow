import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { formatZodError } from "@sql-learn/validation";
import { ApiError } from "../utils/ApiError";

export const validateBody =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(400, "Validation failed", formatZodError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
