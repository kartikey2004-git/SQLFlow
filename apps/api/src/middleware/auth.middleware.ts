import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type UserRole } from "@sql-learn/auth";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: UserRole; sessionId: string };
    }
  }
}

const getBetterAuthSession = (req: Request) =>
  auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

/** Populates req.user when a valid session cookie is present; otherwise 401s. */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const result = await getBetterAuthSession(req);
  if (!result) {
    throw new ApiError(401, "Authentication required");
  }

  req.user = {
    id: Number(result.user.id),
    role: (result.user as { role?: UserRole }).role ?? "student",
    sessionId: result.session.id,
  };
  next();
});

/** Best-effort auth: populates req.user if a valid cookie is present, never rejects. */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const result = await getBetterAuthSession(req);
  if (result) {
    req.user = {
      id: Number(result.user.id),
      role: (result.user as { role?: UserRole }).role ?? "student",
      sessionId: result.session.id,
    };
  }
  next();
});

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Insufficient permissions");
    }
    next();
  };
