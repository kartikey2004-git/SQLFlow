import { z } from "zod";

const isProd = () => process.env.NODE_ENV === "production";

const fail = (label: string, error: z.ZodError): never => {
  const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`);
  throw new Error(`Invalid ${label} environment configuration:\n${lines.join("\n")}\n(see .env.example)`);
};

const required = (name: string) => z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const prodMin = (name: string, min: number) =>
  required(name).refine((v) => !isProd() || v.length >= min, {
    message: `${name} must be at least ${min} characters in production`,
  });

const origins = (v: string): string[] =>
  v.split(",").map((o) => o.trim()).filter(Boolean);

export const parseCorsOrigins = (raw: string | undefined): string[] => origins(raw ?? "");

const apiSchema = () =>
  z.object({
    POSTGRES_URL: required("POSTGRES_URL"),
    DATABASE_URL: required("DATABASE_URL"),
    BETTER_AUTH_SECRET: prodMin("BETTER_AUTH_SECRET", 32),
    BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
    CORS_ORIGIN: required("CORS_ORIGIN").refine((v) => origins(v).length > 0, "CORS_ORIGIN must list at least one origin"),
    CLEANUP_TOKEN: prodMin("CLEANUP_TOKEN", 24),
    PORT: z.coerce.number().int().positive().default(5000),
    METRICS_TOKEN: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
  });

const workerSchema = () =>
  z.object({
    POSTGRES_URL: required("POSTGRES_URL"),
    SANDBOX_ADMIN_DATABASE_URL: required("SANDBOX_ADMIN_DATABASE_URL"),
    SANDBOX_ROLE_SECRET: prodMin("SANDBOX_ROLE_SECRET", 24),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
    PORT: z.coerce.number().int().positive().optional(),
  });

export type ApiEnv = z.infer<ReturnType<typeof apiSchema>>;
export type WorkerEnv = z.infer<ReturnType<typeof workerSchema>>;

export const loadApiEnv = (): ApiEnv => {
  const r = apiSchema().safeParse(process.env);
  return r.success ? r.data : fail("API", r.error);
};

export const loadWorkerEnv = (): WorkerEnv => {
  const r = workerSchema().safeParse(process.env);
  return r.success ? r.data : fail("worker", r.error);
};
