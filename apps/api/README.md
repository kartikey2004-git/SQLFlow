# SQL Learn API

Express + TypeScript backend for the SQL learning platform. It runs as two
processes from this package:

- **API** (`src/index.ts`): HTTP routes, Better Auth, and job submission.
- **Worker** (`src/worker.ts`): consumes the Postgres-backed queue (`pg-boss`)
  and runs student SQL, grading, and sandbox provisioning.

Postgres is the only datastore. It holds app data, the `pgboss` queue schema,
and the Better Auth tables. Student SQL never runs against it. Each student
gets their own database on a separate **sandbox** Postgres instance, with a
login role that can reach only that database.

## Architecture at a glance

| Piece | Where | Connects to |
|---|---|---|
| API | `src/index.ts` → `src/app.ts` | app DB (`POSTGRES_URL`, `DATABASE_URL`) |
| Worker | `src/worker.ts` | app DB (queue, repositories) and sandbox admin DB (`SANDBOX_ADMIN_DATABASE_URL`) |
| Queue | `pg-boss`, schema `pgboss`, queues `sandbox_jobs` and `sandbox_maintenance` | app DB |
| Auth | Better Auth, mounted at `/auth/*` | app DB via Prisma (`DATABASE_URL`) |
| Migrations | `node-pg-migrate`, `migrations/` (the only migration system) | app DB |

Job types on `sandbox_jobs`: `init_sandbox`, `reset_sandbox`, `execute_query`,
and `evaluate_submission`. The API only enqueues them and returns a `jobId`.
Use `GET /sandbox/jobs/:jobId` or the SSE stream to read the result.

Configuration is validated at startup in `src/config/env.ts`. A missing or
invalid required variable stops the process with a message listing what's
wrong.

## Setup

1. Copy `.env.example` to `.env` and fill in the values:
   - `POSTGRES_URL` / `DATABASE_URL`: the app database (the same database for both in local dev).
   - `SANDBOX_ADMIN_DATABASE_URL`: an admin connection on the sandbox server. Locally this is the same server.
   - `SANDBOX_ROLE_SECRET`: `openssl rand -base64 32`. Student passwords are derived from it, so keep it stable.
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`.
   - `CORS_ORIGIN`: the frontend origin, for example `http://localhost:3000`.
   - `CLEANUP_TOKEN`: any random string (at least 24 characters in production).

   On Windows, `openssl` can add a trailing `\r` to generated secrets. Strip it
   before pasting, or database logins will fail.
2. Copy `../../packages/database/.env.example` to `../../packages/database/.env`.
   The Prisma client reads `DATABASE_URL` from that file, not from this one.
3. Start Postgres: `docker compose -f ../../docker/postgres/docker-compose.yaml up -d`
   (copy `docker/postgres/.env.example` to `docker/postgres/.env` first).
4. Install dependencies from the repo root: `bun install`.
5. Run migrations: `bun run migrate up`.
6. Seed sample assignments: `bun run seed` (reads `data/assignments.json`).

The worker and the API both need `POSTGRES_URL` and `SANDBOX_ADMIN_DATABASE_URL`.
The API doesn't use the sandbox connection.

## Running

```bash
bun run dev      # API server (PORT, default 5000)
bun run worker   # worker: required for execute, grade, and sandbox init/reset to complete
```

Both must run for the query and grading flow to finish. The API returns
`202 { jobId }` right away. The worker runs the job and records the result.

Both processes handle `SIGTERM` and `SIGINT`. They stop accepting work, close
SSE streams, and stop pg-boss gracefully before exiting.

### Full stack in Docker

For a production-like local run with `db`, `app`, and `worker` containers, use
the root `docker-compose.yaml`:

```bash
cp apps/api/.env.docker.example apps/api/.env.docker   # fill in real values
docker compose up -d --build
```

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `apps/api/.env.docker`
must match `docker/postgres/.env`. Containers reach Postgres at host `db`, not
`localhost`. Migrations still run from the host against the exposed port
(step 5 above). The compose file has no migration container.

Images are built from `Dockerfile` (API) and `Dockerfile.worker` (worker).
The production deploy path is in [`../../deploy/README.md`](../../deploy/README.md).

## Environment variables

Every variable is listed in `.env.example`, with the optional ones
commented out. `.env.docker.example` covers the compose stack.

Required:
- `POSTGRES_URL`, `DATABASE_URL`
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `CORS_ORIGIN`, `CLEANUP_TOKEN`
- Worker: `SANDBOX_ADMIN_DATABASE_URL`, `SANDBOX_ROLE_SECRET`

Optional (defaults in code):
- `PORT` (5000), `WORKER_METRICS_PORT` (5001), `WORKER_CONCURRENCY` (4)
- `POSTGRES_POOL_MAX` (5), `PGBOSS_POOL_MAX` (4), `SANDBOX_ADMIN_POOL_MAX` (4)
- `SANDBOX_SCRIPT_TIMEOUT_MS` (15000), `SANDBOX_MAX_DB_BYTES` (200 MB)
- `COOKIE_DOMAIN`, `METRICS_TOKEN`, `LOG_LEVEL` (info)
- Social login: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`. Leave blank to disable.
- AI hints: `GOOGLE_GENERATIVE_AI_API_KEY`. Leave blank and hints return 501.

Pool sizes are per process. Keep the sum across all API and worker instances
below the database's `max_connections`.

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `ALL` | `/auth/*` | Better Auth | Sign up, sign in, sign out, session |
| GET | `/assignments` | none | Published assignments |
| GET | `/assignments/:id` | none | One assignment (solution never included) |
| POST | `/sandbox/init` | session | Queue sandbox creation |
| POST | `/sandbox/reset` | session | Queue a rebuild from the template |
| POST | `/sandbox/execute` | session | Queue a student script (`{ assignmentId, query }`) |
| POST | `/sandbox/grade` | session | Queue grading |
| GET | `/sandbox/jobs/:jobId` | session (owner only) | Job state and output |
| GET | `/sandbox/jobs/:jobId/stream` | session (owner only) | Same, as SSE |
| GET | `/progress/all`, `/progress/:assignmentId` | session | Attempt progress |
| PUT | `/progress/:assignmentId` | session | Save last query, bump attempts |
| POST | `/hints` | session | AI hint (rate limited per user) |
| GET | `/hints/history` | session | Hint history |
| POST | `/cleanup/perform` | `x-cleanup-authorization` header | Run maintenance now |
| GET | `/cleanup/stats` | `x-cleanup-authorization` header | Sandbox counts |

Job status is returned only to the user who submitted the job. Other users get
404, so job IDs can't be probed.

## Sandbox model

- Each student has one database and one login role, both named from their user ID.
- Passwords are derived from `SANDBOX_ROLE_SECRET`, so none are stored.
- Each assignment has a template database. Student databases are cloned from it.
- Grading runs in a throwaway copy that's dropped afterwards, so one student's
  changes can't affect another's grade.
- Student roles have no superuser, database-creation, or role-creation rights,
  and no access to other databases.
- A worker-side watchdog enforces `SANDBOX_SCRIPT_TIMEOUT_MS` even if a
  student's script turns off `statement_timeout`.
- Per-student databases are capped at `SANDBOX_MAX_DB_BYTES`.

The SQL validator is gone. Student input is run as written, and the database
roles are the security boundary.

## Maintenance

`sandbox_maintenance` jobs drop idle student databases and orphaned grading
databases, and reconcile submissions stuck in `evaluating`. Trigger a run with
`POST /cleanup/perform` (the `x-cleanup-authorization` header must match
`CLEANUP_TOKEN`). The production schedule is a Cloud Scheduler job; see
`deploy/gcp/11-scheduler.sh`.

## Linting and typechecking

```bash
bun run lint        # eslint, config shared via @sql-learn/config-eslint
bun run typecheck   # tsc --noEmit, covers src/, tests/, and scripts/
```

Both also run across all packages from the repo root (`turbo run <task>`).

## Testing

Tests need a separate database and sandbox admin connection. They never touch
the dev databases.

```bash
# in .env, set TEST_DATABASE_URL and TEST_SANDBOX_ADMIN_DATABASE_URL
bun run migrate:test up   # once, to set up the test database
bun run test
```

`tests/setup.ts` points the app config at the test databases and fills in
test-only defaults for `SANDBOX_ROLE_SECRET` and `CLEANUP_TOKEN` if they're unset.

The `tests/security/` suite checks the sandbox boundary directly against the
database: no cross-student connections, no `SET ROLE` into another student's
role, no escalation via role attributes, enforced connection and temp-file
limits, and lock isolation between students.

## Observability

- `GET /livez`: process is up. No dependency checks.
- `GET /health`: checks Postgres and the queue. Returns 503 if either fails.
- `GET /metrics` (API): Prometheus format. If `METRICS_TOKEN` is set, send it as
  a bearer token.
- Worker: `http://localhost:5001/metrics` and `/health` on `WORKER_METRICS_PORT`.

Logs are JSON (pino). Request bodies and student SQL are not logged.

## Project layout

- `src/index.ts`, `src/app.ts`: API entry point and Express app
- `src/worker.ts`: worker entry point
- `src/config/env.ts`: startup validation for API and worker config
- `src/routes/`, `src/controllers/`, `src/middleware/`: HTTP layer
- `src/services/`: business logic, including `sandbox/` (databases, roles, script execution, grading, maintenance)
- `src/repositories/`: raw `pg` queries against the app database
- `src/queue/`: pg-boss setup and job types
- `migrations/`: `node-pg-migrate` migrations
- `scripts/`: seed and one-off backfill
- `tests/`: unit, integration, and security tests
