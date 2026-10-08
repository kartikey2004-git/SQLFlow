import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const byUserOrIp = (req: Request): string =>
  req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;

export const executeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many query executions - slow down", data: null, errors: [] },
});

export const gradeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many submissions - slow down", data: null, errors: [] },
});

export const hintRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many hint requests - slow down", data: null, errors: [] },
});

export const sandboxLifecycleRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many sandbox requests - slow down", data: null, errors: [] },
});

export const jobReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many job status requests - slow down", data: null, errors: [] },
});
