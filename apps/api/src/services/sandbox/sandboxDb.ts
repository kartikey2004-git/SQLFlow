import { createHmac } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

let adminPool: pg.Pool | undefined;

function adminUrl(): URL {
  const raw = process.env.SANDBOX_ADMIN_DATABASE_URL;
  if (!raw) throw new Error("SANDBOX_ADMIN_DATABASE_URL is not set");
  return new URL(raw);
}

export function getSandboxAdminPool(): pg.Pool {
  if (!adminPool) {
    adminPool = new Pool({
      connectionString: adminUrl().toString(),
      max: Number(process.env.SANDBOX_ADMIN_POOL_MAX ?? 4),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    adminPool.on("error", () => {
    });
  }
  return adminPool;
}

export async function closeSandboxAdminPool(): Promise<void> {
  const p = adminPool;
  adminPool = undefined;
  if (p) await p.end();
}

export function adminUrlForDb(database: string): string {
  const u = adminUrl();
  u.pathname = `/${encodeURIComponent(database)}`;
  return u.toString();
}

function rolePassword(role: string): string {
  const secret = process.env.SANDBOX_ROLE_SECRET;
  if (!secret) throw new Error("SANDBOX_ROLE_SECRET is not set");
  return createHmac("sha256", secret).update(role).digest("hex");
}

export function roleUrlForDb(role: string, database: string): string {
  const u = adminUrl();
  u.username = role;
  u.password = rolePassword(role);
  u.pathname = `/${encodeURIComponent(database)}`;
  return u.toString();
}

export const rolePasswordFor = rolePassword;

export const studentRole = (userId: number) => `student_u${userId}`;
export const studentDbName = (userId: number, assignmentId: number) => `student_u${userId}_a${assignmentId}`;
export const templateDbName = (assignmentId: number) => `sandbox_template_a${assignmentId}`;
export const gradingDbName = (submissionId: number) => `grade_s${submissionId}`;
export const gradingRole = (submissionId: number) => `grade_s${submissionId}`;

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;
