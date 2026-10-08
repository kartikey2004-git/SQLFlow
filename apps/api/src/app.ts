import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@sql-learn/auth";
import { pool } from "@sql-learn/database";
import { getBoss } from "./queue/boss";
import { parseCorsOrigins } from "./config/env";
import { ApiError } from "./utils/ApiError";
import { logger, requestLogger } from "./utils/logger";
import { registry, httpRequestDuration } from "./utils/metrics";
import assignmentRoutes from "./routes/assignment.routes";
import sandboxRoutes from "./routes/sandbox.routes";
import progressRoutes from "./routes/progress.routes";
import hintRoutes from "./routes/hint.routes";
import cleanupRoutes from "./routes/cleanup.routes";

export const createApp = () => {
  const app = express();
  app.set("trust proxy", 1);

  const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (corsOrigin.length === 0) {
    throw new Error("CORS_ORIGIN must be set - refusing to start without it (see .env.example)");
  }
  app.use(cors({ origin: corsOrigin, credentials: true }));

  app.all("/auth/*splat", toNodeHandler(auth));

  app.use(express.json());
  app.use(requestLogger);

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      httpRequestDuration.observe(
        { method: req.method, route, status_code: String(res.statusCode) },
        durationSeconds,
      );
    });
    next();
  });

  app.get("/livez", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      const boss = await getBoss();
      const queueOk = (await boss.getQueue("sandbox_jobs")) !== null;
      res.json({ ok: true, postgres: true, queue: queueOk });
    } catch (error) {
      logger.error({ err: error }, "Health check failed");
      res.status(503).json({ ok: false });
    }
  });

  app.get("/metrics", async (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
      if (req.header("x-metrics-token") !== token) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });

  app.use("/assignments", assignmentRoutes);
  app.use("/sandbox", sandboxRoutes);
  app.use("/progress", progressRoutes);
  app.use("/hints", hintRoutes);
  app.use("/cleanup", cleanupRoutes);

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    (req.log ?? logger).error({ err }, err.message);

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: err.success,
        message: err.message,
        data: err.data,
        errors: err.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
      errors: [],
    });
  });

  return app;
};
