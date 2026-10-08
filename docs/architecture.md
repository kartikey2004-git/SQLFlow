# SqlFlow architecture

SqlFlow is a SQL practice platform. Students write PostgreSQL in the browser, the platform runs it
against their own database, and grades the result. This document describes how the pieces fit together,
and why.

Statements here come from the code and configuration in this repository. Anything marked **UNVERIFIED**
has not been confirmed against a live deployment.

## Contents

1. [Components](#1-components)
2. [Production topology](#2-production-topology)
3. [Request flow](#3-request-flow)
4. [Student isolation](#4-student-isolation)
5. [What students can run](#5-what-students-can-run)
6. [Data and queues](#6-data-and-queues)
7. [Migrations](#7-migrations)
8. [Environments](#8-environments)
9. [Observability](#9-observability)
10. [Known limits and risks](#10-known-limits-and-risks)

## 1. Components

| Component | Code | Role |
|---|---|---|
| Web | `apps/web` (Next.js 16) | Pages, SQL editor, sign-in, and submissions. No database access. |
| API | `apps/api/src/index.ts`, `app.ts` | HTTP routes, Better Auth, and job submission. It never runs student SQL. |
| Worker | `apps/api/src/worker.ts` | Consumes queues. Provisions sandboxes, runs scripts, grades, and cleans up. |
| App database | PostgreSQL 17 | Better Auth tables, users, assignments, attempts, submissions, hints, and the `pgboss` queue schema. |
| Sandbox database | PostgreSQL 17, separate instance | One database and login role per student and assignment, templates, and throwaway grading databases. |
| Queue | pg-boss, inside the app database | Carries `sandbox_jobs` and `sandbox_maintenance`. No Redis. |

Two rules shape everything else:

- **The API never connects to the sandbox instance.** Only the worker holds `SANDBOX_ADMIN_DATABASE_URL`
  and `SANDBOX_ROLE_SECRET`. Anything that touches sandbox databases, including cleanup, goes through the queue.
- **Student SQL never runs in the app database.** Student work is isolated on its own instance.

## 2. Production topology

```
  Browser
     |
     +--> app.<domain>  (Vercel, apps/web) ---- proxy or direct ----+
     |                                                              |
     +--> api.<domain>  (Cloud Run service sqlflow-api) <-----------+
                |  min 1 / max 3 instances, concurrency 50, 60 s timeout
                |  Direct VPC egress
                v
  +-----------------------------------------------------------------------+
  |  VPC sqlflow-vpc  (Private Service Access to Cloud SQL)               |
  |                                                                       |
  |   Cloud SQL sqlflow-app  (PG17, private IP)                           |
  |     Better Auth, app data, pg-boss schema "pgboss"                    |
  |            ^                                                          |
  |            | queue + repositories                                     |
  |            |                                                          |
  |   Cloud Run worker pool sqlflow-worker                                |
  |     1 to 2 instances x WORKER_CONCURRENCY=4, always-on CPU            |
  |            |                                                          |
  |            | SANDBOX_ADMIN_DATABASE_URL (provisioning)                |
  |            | student role connections (scripts, grading)              |
  |            v                                                          |
  |   Cloud SQL sqlflow-sandbox  (PG17, private IP)                       |
  |     student_u<id>_a<assignment>   per student and assignment         |
  |     sandbox_template_a<assignment> templates, never connected to      |
  |     grade_s<submission>           throwaway grading databases         |
  +-----------------------------------------------------------------------+

  Cloud Scheduler --POST /cleanup/perform (x-cleanup-authorization)--> API
```

Secrets come from Secret Manager, mounted into the services. They are never baked into images.
Deployment steps are in [`deploy/README.md`](../deploy/README.md).

## 3. Request flow

1. **Sign in.** The browser calls `POST /auth/*`, which Better Auth serves from the API. The session cookie
   is scoped to `COOKIE_DOMAIN`, and the API allows `CORS_ORIGIN` with credentials.
2. **Submit.** `POST /sandbox/init`, `/reset`, `/execute`, or `/grade` validates the body and enqueues a job.
   The job's singleton key is `user:<id>`, so each student has at most one active job. The response is
   `202 { data: { jobId } }`.
3. **Run.** A worker takes the job (`localConcurrency = WORKER_CONCURRENCY`), does the work, and stores the
   result on the job row.
4. **Follow.** The client calls `GET /sandbox/jobs/:id/stream` (server-sent events) or polls
   `GET /sandbox/jobs/:id`. The stream checks the job every 500 ms, sends a heartbeat every 10 s, and closes
   after 20 s, after which the client should poll. Only the job's owner can read it. Anyone else gets a 404,
   so job IDs can't be probed.

## 4. Student isolation

Implemented in `apps/api/src/services/sandbox/`.

### Identity and naming

| Object | Name | Created by |
|---|---|---|
| Student role | `student_u<userId>` | `ensureRole` (once per student) |
| Student database | `student_u<userId>_a<assignmentId>` | `cloneFromTemplate` (once per student and assignment) |
| Template database | `sandbox_template_a<assignmentId>` | Template build (once per assignment) |
| Grading role and database | `grade_s<submissionId>` | Per submission, dropped afterwards |

Students connect **directly as their own role** to their own database. There is no `SET ROLE` and no shared
runner role. The worker opens one connection per script, as the student's role.

### Access control

- **Database privileges.** `CREATE DATABASE ... TEMPLATE <template> OWNER <role>`, then
  `REVOKE ALL ON DATABASE ... FROM PUBLIC` and `GRANT CONNECT` to the owner only. The database
  connection limit is `ROLE_CONNECTION_LIMIT + 2` (5). Other students can't connect to it.
- **System databases.** At worker startup, `hardenInstance` revokes `CONNECT` from `PUBLIC` on
  `postgres` and `template1`. It is best effort: a warning is logged if the admin isn't the owner.
  `deploy/sql/sandbox-bootstrap.sql` does the same. **UNVERIFIED** on Cloud SQL, where the admin is not a true superuser.
- **Role attributes.** Roles are created with `LOGIN NOINHERIT CONNECTION LIMIT 3 PASSWORD ...`. On
  re-provisioning, `NOCREATEDB NOCREATEROLE` are re-asserted too. The `NO*` forms that Cloud SQL rejects
  (`NOSUPERUSER`, `NOREPLICATION`, `NOBYPASSRLS`) are never named, because Postgres refuses them for
  `cloudsqlsuperuser` members. Roles are not granted any `pg_*` predefined role.
- **Role settings.** Applied with `ALTER ROLE ... SET`, best effort:

  | Setting | Value |
  |---|---|
  | `statement_timeout` | 10 s |
  | `lock_timeout` | 3 s |
  | `idle_in_transaction_session_timeout` | 15 s |
  | `work_mem` | 8 MB |
  | `temp_file_limit` | 64 MB |
  | `max_parallel_workers_per_gather` | 0 |

  If Cloud SQL refuses a setting (`42501`), the worker logs a warning and relies on the instance-level
  default. Whether `temp_file_limit` can be set on Cloud SQL is **UNVERIFIED**.
- **Passwords are derived, not stored.** `HMAC-SHA256(SANDBOX_ROLE_SECRET, role name)`, hex-encoded. Rotating
  the secret changes every derived password, and the roles are re-asserted on next provisioning
  (**UNVERIFIED** path).

### Time limit (watchdog)

`statement_timeout` is a baseline, not a guarantee. A student can override USERSET settings with
`SET statement_timeout = 0`. So the worker enforces a deadline per script:

1. After `SANDBOX_SCRIPT_TIMEOUT_MS` (15 s by default), it calls `pg_cancel_backend` on the student's backend.
2. After a 1 s grace period, if the backend is still running, it calls `pg_terminate_backend`.

The result reports the script as cancelled because it exceeded the time limit.

### Grading

Grading runs in a throwaway copy of the template, under a throwaway role, named `grade_s<submissionId>`.
The student's working copy is never touched. The copy is dropped afterwards. This also makes it safe to
validate post-state (DML and DDL) in the grading copy.

### Cleanup

`POST /cleanup/perform` (header `x-cleanup-authorization` must match `CLEANUP_TOKEN`) does three things:

1. Marks submissions stuck in `evaluating` for more than 5 minutes as failed.
2. Deletes `query_executions` older than `daysToKeep` days.
3. Enqueues a `sandbox_maintenance` job, which:
   - drops student databases whose attempt has not been touched for `daysToKeep` days,
   - drops unreferenced `student_u*` databases older than 1 hour,
   - drops `grade_s*` databases older than 15 minutes,
   - drops orphaned `student_u*` and `grade_s*` roles.

`GET /cleanup/stats` returns counts for the same tables.

### Trust boundary

The worker is the only process that can provision or drop sandbox databases. The provisioning role
(`sqlflow_sandbox_admin` in production) is a `cloudsqlsuperuser` member, not a real superuser. If the worker
is compromised, every sandbox database is exposed. The app database is exposed only through `POSTGRES_URL`,
which the worker also holds.

### Residual risks

- **Shared resources.** CPU, I/O, and disk are shared across students on the sandbox instance. The guards are
  `temp_file_limit`, the per-role connection limit, `SANDBOX_MAX_DB_BYTES` (200 MB by default, checked before each run),
  and the time limit.
- **Coverage.** The adversarial suite in `apps/api/tests/security/` covers the cases listed in its tests. It is not exhaustive.

## 5. What students can run

Implemented in `scriptRunner.ts` and `execution.service.ts`.

- **Scripts.** A script is split into statements using the real PostgreSQL grammar (`pgsql-parser`). The parser
  finds statement boundaries only. It is not a security control. If parsing fails, the whole input is sent as
  one statement.
- **Scope.** Full DDL and DML inside the student's own database: `CREATE`, `ALTER`, `DROP`, `INSERT`,
  `UPDATE`, `DELETE`, transactions, temporary tables, CTEs, and window functions.
- **Errors.** Execution stops at the first error. Earlier statements keep their results.
- **Results.** Each statement returns its command tag, row count, column names, rows, and duration.
- **Output caps.** 1,000 rows or 1,000,000 bytes per statement, whichever comes first. Capped results are
  marked `truncated`, and their row count is not reported.
- **Time and size.** The 15 s watchdog (`SANDBOX_SCRIPT_TIMEOUT_MS`) and the 200 MB database size check
  (`SANDBOX_MAX_DB_BYTES`).
- **Not available.** Superuser features and server-side file access. Extensions are **UNVERIFIED**: the sandbox
  does not install them, and nothing has been tested against Cloud SQL's extension list.

## 6. Data and queues

**App database.** Better Auth tables, users, assignments and test cases, attempts, submissions and their
evaluation results, query execution log, hint requests, and the `pgboss` schema.

**Queues** (pg-boss, `apps/api/src/queue/boss.ts`):

| Queue | Policy | Retries | Expiry | Carries |
|---|---|---|---|---|
| `sandbox_jobs` | `singleton` (per `singletonKey`) | 1 | 120 s | `init_sandbox`, `reset_sandbox`, `execute_query`, `evaluate_submission` |
| `sandbox_maintenance` | `singleton` | 0 | 600 s | Cleanup and sandbox maintenance |

**Concurrency.** The target is 2 worker instances with 4 jobs each, so 8 sandbox jobs can run at once.
The Starter deployment runs 1 instance, so 4 can run at once.
Raise `WORKER_CONCURRENCY` only together with the connection budget: `SANDBOX_ADMIN_POOL_MAX`,
`POSTGRES_POOL_MAX`, and `PGBOSS_POOL_MAX`.

**Idempotency.** Submissions and query executions store `job_id` with a unique index, so a redelivered job
does not create a second row.

## 7. Migrations

- **`node-pg-migrate` is authoritative** for the app database. Migrations live in `apps/api/migrations`.
- **Prisma is for client generation only.** `prisma generate` runs during the image build with a dummy
  `DIRECT_URL`. Production never runs `prisma migrate`.
- **Production migrations** run as a Cloud Run Job inside the VPC (`deploy/gcp/08-migrate.sh`).
- **The sandbox instance has no migrations.** The worker creates databases and roles at runtime, after the
  one-time bootstrap SQL.

## 8. Environments

| Environment | App database | Sandbox database | Defined in |
|---|---|---|---|
| Local, full stack | `app-db` on `:5432` | `sandbox-db` on `:5433`, admin is the `postgres` superuser | `docker-compose.yaml` |
| Local, host-based dev | `db` on `:5432` | Same server (`docker/postgres/`) | `docker/postgres/docker-compose.yaml` |
| CI | `postgres` service on `:5432` | `postgres-sandbox` service on `:5433` | `.github/workflows/ci.yml` |
| Production | Cloud SQL `sqlflow-app` | Cloud SQL `sqlflow-sandbox` | `deploy/gcp/` |

Local and CI sandboxes use a true superuser as admin. Behaviour that depends on Cloud SQL's
restricted `cloudsqlsuperuser` model (role grants, `temp_file_limit`, `REVOKE ... FROM PUBLIC` on system databases)
is **not** exercised there. Run a smoke test on the real instance after any change to provisioning.

## 9. Observability

| Endpoint | Process | Meaning |
|---|---|---|
| `GET /livez` | API | The process is up. No dependency checks. |
| `GET /health` | API | Postgres and the queue respond. Returns 503 otherwise. |
| `GET /metrics` | API | Prometheus format. If `METRICS_TOKEN` is set, send it in the `x-metrics-token` header. If it is unset, the endpoint is open outside production and returns 404 in production. |
| `GET /health`, `GET /livez`, `GET /metrics` | Worker | Served on `PORT` when Cloud Run sets it, otherwise on `WORKER_METRICS_PORT` (default 5001). |

`deploy/gcp/12-monitoring.sh` creates:

- an uptime check on `/health` (`sqlflow-api-health`) and an alert when it fails,
- an alert on the API 5xx rate,
- CPU and connection-count alerts for each Cloud SQL instance.

Logs are JSON (pino) and go to stdout. Request bodies are not logged.

## 10. Known limits and risks

- **Single worker in production.** The Starter sizing runs one worker instance. It is a single point of
  failure for every sandbox job.
- **Instance size.** Production databases are on the smallest tier (db-g1-small), with no SLA. Load testing
  against authenticated users has not been done. The first bottleneck has not been identified.
- **Rate limiting.** The Better Auth limiter and the API's express-rate-limit store are in memory and per
  instance. The queue's one-active-job-per-student rule is the real per-user limit.
- **Graceful shutdown.** Both API and worker handle `SIGTERM` and `SIGINT`: they stop accepting work, close
  streams, and stop pg-boss. This has been checked in code but not in a deployed container.
- **Large single values.** A single very large value in a result row can use worker memory before the 1 MB
  output cap applies.
- **Disabled features.** Google and GitHub sign-in and AI hints are off in production, because their secrets
  were not provided.
