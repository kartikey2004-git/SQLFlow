import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

// In-memory store (express-rate-limit's default) - fine for a single-instance
// deployment; would need a shared store (e.g. Redis) only once running more
// than one API process, which this project doesn't do.

// ipKeyGenerator normalizes IPv6 addresses to their /64 prefix so a client
// can't dodge the limit by cycling addresses within their own subnet.
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

// The real hint cap is identity-based and lives in HintService (10/hour,
// 4/assignment) - this is a coarser network-level backstop on top of it.
export const hintRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  message: { success: false, message: "Too many hint requests - slow down", data: null, errors: [] },
});
