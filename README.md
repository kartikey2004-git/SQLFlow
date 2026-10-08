# SqlFlow

SqlFlow is a SQL-learning platform. Students open an assignment, write SQL in the browser, run it against their own
PostgreSQL database, and submit for automated grading.

## Repository layout

| Path | What it is |
|------|------------|
| `apps/web` | Next.js 16 frontend, deployed to Vercel |
| `apps/api` | Express API (`src/index.ts`) and pg-boss worker (`src/worker.ts`). One package, two entry points. |
| `packages/*` | Shared code: `auth` (Better Auth), `database` (pg and the Prisma client), `types`, `validation`, `ui`, and configs |
| `deploy/` | GCP and Vercel deployment scripts and the runbook |
| `docs/architecture.md` | Architecture, isolation model, and design details |
| `loadtest/` | A k6 script and a dependency-free Node load tester |

Monorepo: bun 1.3.3 with Turborepo. The API and worker run under Node with `tsx`, not Bun's runtime.

## Architecture

Production layout (Google Cloud and Vercel):

```
Browser -> Vercel (sqlflow-web, apps/web)
              |  same-origin proxy (no custom domain) or CORS + cookies (custom domain)
              v
        Cloud Run service sqlflow-api --private VPC--> Cloud SQL sqlflow-app (PG17)
                                                         Better Auth, app data, pg-boss queue
                                                              ^
        Cloud Run worker pool sqlflow-worker (1-2 instances, WORKER_CONCURRENCY=4)
                |  private VPC
                v
        Cloud SQL sqlflow-sandbox (PG17)
            one database and login role per student and assignment
            template database per assignment
            throwaway grading databases

Cloud Scheduler -> POST /cleanup/perform   (header x-cleanup-authorization)
```

The API never connects to the sandbox instance. Only the worker holds the sandbox admin credentials.
Full details are in [docs/architecture.md](docs/architecture.md).

## Student isolation

* Each student has a login role (`student_u<id>`) and one database per assignment (`student_u<id>_a<assignment>`).
  Students connect directly as their own role. **There is no `SET ROLE`.**
* Each database has `REVOKE ALL ... FROM PUBLIC` and `GRANT CONNECT` to its owner only, so students can't reach each other's data.
* Roles are created with `LOGIN NOINHERIT CONNECTION LIMIT 3`, plus `NOCREATEDB NOCREATEROLE`. They have no `pg_*`
  predefined roles. Cloud SQL rejects naming `NOSUPERUSER`, `NOREPLICATION`, or `NOBYPASSRLS`, so those aren't written out.
* Role-level limits (`statement_timeout`, `lock_timeout`, `work_mem`, `temp_file_limit`, and others) are applied as a best effort.
* A worker-side watchdog cancels a script after `SANDBOX_SCRIPT_TIMEOUT_MS` (15 s by default), then terminates the backend,
  because students can override `statement_timeout`.
* Grading runs in a throwaway database copied from the assignment template and is dropped afterwards.
* Cleanup removes idle student databases and orphaned grading databases and roles on a schedule.

## SQL capabilities

Students can run multi-statement scripts with full DDL and DML in their own database, including transactions and temporary tables.
Execution stops at the first error. Results are capped at 1,000 rows or about 1 MB per statement.
See [docs/architecture.md](docs/architecture.md#5-what-students-can-run).

## Local development

Prerequisites: bun 1.3.3, Node 22, Docker.

```bash
bun install
docker compose up -d app-db sandbox-db                 # app DB on :5432, sandbox DB on :5433 (admin role "postgres")
docker compose --profile tools run --rm migrate        # schema (node-pg-migrate)

# Host-based development (fast reload):
cp apps/api/.env.example apps/api/.env                 # then fill in the values from the table below
bun run dev                                            # API on :5000 and web via Turborepo; worker: bun run worker

# Or run everything in containers:
docker compose up -d --build api worker                # API on http://localhost:5000
```

Connection strings for the compose databases, for host-based development:

* `POSTGRES_URL=postgres://postgres:postgres@localhost:5432/sqlflow`
* `SANDBOX_ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres`

Seed sample assignments with `bun run seed` in `apps/api`.

Tests: `bun run test`. They need `TEST_DATABASE_URL` and `TEST_SANDBOX_ADMIN_DATABASE_URL`. Run `bun run migrate:test up`
in `apps/api` first.

## Environment variables

Names only. Values come from `.env`, Secret Manager, or Vercel.

| Variable | API | Worker | Web | Notes |
|----------|:---:|:------:|:---:|-------|
| `POSTGRES_URL` | x | x | | App database (pg, pg-boss, migrations) |
| `DATABASE_URL` | x | x | | Prisma client and app data (same database) |
| `BETTER_AUTH_SECRET` | x | | | |
| `BETTER_AUTH_URL` | x | | | The API's public URL |
| `CORS_ORIGIN` | x | | | Comma-separated list. Also used as Better Auth's trusted origins. |
| `COOKIE_DOMAIN` | x | | | For example `.example.com`. Only with a custom domain. |
| `CLEANUP_TOKEN` | x | | | Required for `/cleanup/*` |
| `PORT` | x | x | | Cloud Run sets 8080. The worker uses `PORT` if set, otherwise `WORKER_METRICS_PORT` (default 5001). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | x | | | Optional |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | x | | | Optional |
| `GOOGLE_GENERATIVE_AI_API_KEY` | x | | | Optional, for AI hints |
| `METRICS_TOKEN` | x | | | Optional. Sent as `x-metrics-token` to read `/metrics`. |
| `SANDBOX_ADMIN_DATABASE_URL` | | x | | Provisioner for the sandbox instance |
| `SANDBOX_ROLE_SECRET` | | x | | Derives student role passwords |
| `WORKER_CONCURRENCY` | | x | | Default 4 |
| `NEXT_PUBLIC_API_URL` | | | x | Build-time |
| `API_ORIGIN`, `NEXT_PUBLIC_AUTH_URL` | | | x | Optional. Used only for the same-origin proxy mode. |
| `TEST_DATABASE_URL`, `TEST_SANDBOX_ADMIN_DATABASE_URL` | | | | Tests only |

Other tuning variables read by the code: `SANDBOX_SCRIPT_TIMEOUT_MS`, `SANDBOX_MAX_DB_BYTES`, `PGBOSS_POOL_MAX`,
`POSTGRES_POOL_MAX`, `SANDBOX_ADMIN_POOL_MAX`, and `LOG_LEVEL`. See `apps/api/.env.example` for defaults.

## Deployment

The production stack is deployed to project `sqlflow-prod` in `asia-south1`, on the Starter sizing. The web app is
the Vercel project `sqlflow-web`.

The runbook is in [deploy/README.md](deploy/README.md). It covers the ordered steps, DNS, the no-custom-domain
proxy setup, and rollback. Every GCP script aborts unless `CONFIRM=yes` is set, and each one prints its plan first.

Images: `docker build -f apps/api/Dockerfile -t sqlflow-api .` and
`docker build -f apps/api/Dockerfile.worker -t sqlflow-worker .`. Run both from the repo root. CI builds both images without pushing them.

## Migration policy

`node-pg-migrate` in `apps/api/migrations` is the only schema migration system, and it is the source of truth. Prisma generates the
client only. Never run `prisma migrate` or `db push` against a real database. The sandbox instance has no migrations.

## Load testing

`loadtest/k6-sqlflow.js` (k6) and `loadtest/run.mjs` (Node 20 or later, no dependencies) run the same flow: sign-up, sign-in,
assignment listing, sandbox init, a SELECT, and grading. They run at 10, 50, 100, 250, and 500 virtual users by default, and report
p50, p95, p99, RPS, and error counts as JSON.

```bash
node loadtest/run.mjs --base https://api.example.com --origin https://app.example.com --stages 10,50 --stage-seconds 60 --out result.json
k6 run -e BASE_URL=https://api.example.com -e ORIGIN=https://app.example.com loadtest/k6-sqlflow.js
```
