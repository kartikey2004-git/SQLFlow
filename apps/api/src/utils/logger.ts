import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "password", "*.password"],
    censor: "[redacted]",
  },
});

// Per-request child logger with a correlation ID that round-trips via
// X-Request-Id, so a request can be traced across app -> queue -> worker logs.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  // Don't log full query text/request bodies - they can carry student SQL or
  // secrets in query params; keep logs to method/path/status/duration.
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
