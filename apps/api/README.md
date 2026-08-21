# SQL Learn API

Express + TypeScript backend for the SQL learning platform. Postgres is the
only database (schema-per-assignment sandboxes, a dedicated low-privilege
`sandbox_runner` role for executing student SQL, and app data in the same
instance). Background work (query execution, grading) runs through a
Postgres-native job queue (`pg-boss`), processed by a separate worker process.

## Setup

1. Copy `.env.example` to `.env` and fill in real values. `SANDBOX_DB_PASSWORD`
   becomes the login password for the `sandbox_runner` role created by
   migrations - pick something and keep it consistent with
   `SANDBOX_DATABASE_URL`. Also copy `../../packages/database/.env.example`
   to `../../packages/database/.env` - the Prisma client (app-data CRUD)
   reads its `DATABASE_URL`/`DIRECT_URL` from that file specifically, not
   from this one, even though it's typically the same physical database as
   this file's `POSTGRES_URL` (see `packages/database/src/prisma.ts`'s
   comment for why there are two files).
2. Start Postgres: `docker compose -f ../../docker/postgres/docker-compose.yaml up -d`
   (copy `docker/postgres/.env.example` to `docker/postgres/.env` first).
3. Install dependencies from the repo root: `bun install`
4. Run migrations: `bun run migrate up`
5. Seed sample assignments: `bun run seed`

## Running

```bash
bun run dev      # API server (port 5000 by default)
bun run worker   # job queue worker - required for /sandbox/execute and /sandbox/grade to complete
```

Both must be running for the query execution / grading flow to work end to
end: the API enqueues a job and returns a `jobId` immediately; the worker is
what actually runs the query and completes the job.

App code lives under `src/` (entry points `src/index.ts` / `src/worker.ts`);
`tests/`, `migrations/`, and `scripts/` stay at the top level.

### Alternative: run everything in Docker

The steps above (host-based `bun run dev`/`bun run worker` against just a
dockerized Postgres) are the fastest path for local iteration (`tsx watch`
reload) and remain the primary documented flow. For a production-like local
run instead - `db` + `app` + `worker` all containerized - use the root
`docker-compose.yaml`:

```bash
cp apps/api/.env.docker.example apps/api/.env.docker   # fill in real values;
                                                        # POSTGRES_USER/PASSWORD/DB
                                                        # must match docker/postgres/.env
docker compose up -d --build
```

Migrations still run from the host against the exposed port (same as
step 4 above) - this compose intentionally has no migration-runner
container, to avoid building infra for a one-time setup step.

## Linting / Typechecking

```bash
bun run lint        # eslint, config shared via @sql-learn/config-eslint
bun run typecheck    # tsc --noEmit, config shared via @sql-learn/config-typescript
```

Both are also runnable from the repo root across all packages via
`bun run lint` / `bun run typecheck` (delegates to `turbo run <task>`).

## Testing

Tests run against a separate database (`TEST_DATABASE_URL`/
`TEST_SANDBOX_DATABASE_URL` in `.env`) - never the dev one.

```bash
bun run migrate:test up   # once, to set up the test database
bun run test
```

Includes an adversarial security suite (`tests/security/`) that connects
directly as `sandbox_runner` and asserts the DB-level privilege boundary
holds independent of the app-level SQL validator.

## Observability

- `GET /health` - checks Postgres + queue connectivity
- `GET /metrics` (API process) / `http://localhost:5001/metrics` (worker
  process, port from `WORKER_METRICS_PORT`) - Prometheus format
