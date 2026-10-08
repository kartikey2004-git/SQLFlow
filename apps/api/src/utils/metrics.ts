import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from "prom-client";
import { getBoss, SANDBOX_QUEUE } from "../queue/boss";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const queryExecutionDuration = new Histogram({
  name: "query_execution_duration_seconds",
  help: "Sandbox SQL query execution duration in seconds",
  labelNames: ["status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 3, 5],
  registers: [registry],
});

export const queryTimeoutTotal = new Counter({
  name: "query_timeout_total",
  help: "Count of sandbox query executions that hit the statement timeout - a proxy for adversarial/expensive queries",
  registers: [registry],
});

new Gauge({
  name: "sandbox_queue_depth",
  help: "Current pg-boss sandbox_jobs queue depth by state",
  labelNames: ["state"],
  registers: [registry],
  async collect() {
    try {
      const boss = await getBoss();
      const queue = await boss.getQueue(SANDBOX_QUEUE);
      if (!queue) return;
      this.set({ state: "ready" }, queue.readyCount);
      this.set({ state: "active" }, queue.activeCount);
      this.set({ state: "failed" }, queue.failedCount);
    } catch {
    }
  },
});
