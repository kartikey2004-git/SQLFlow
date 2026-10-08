# Deployment runbook (GCP + Vercel)

This runbook deploys SqlFlow to production. The architecture is described in
[docs/architecture.md](../docs/architecture.md).

| Piece | Where it runs | Talks to |
|---|---|---|
| Web (`apps/web`) | Vercel, `app.<domain>` | API, through `api.<domain>` or a same-origin proxy |
| API (`apps/api`) | Cloud Run service `sqlflow-api`, `api.<domain>` | `sqlflow-app` over a private IP |
| Worker (`apps/api`) | Cloud Run worker pool `sqlflow-worker` | `sqlflow-app` and `sqlflow-sandbox` |
| Databases | Cloud SQL PostgreSQL 17, private IP only | Each other, through the VPC only |

> **Status.** The scripts were written before any GCP project existed. They have been run against
> `sqlflow-prod` (see [Current deployment](#9-current-deployment)). Flags marked `UNVERIFIED` in the scripts
> track gcloud surfaces that change often. Run a script without `CONFIRM=yes` first (a dry run), read the plan,
> and adjust any flag that differs from `gcloud ... --help`.

## Contents

1. [Before you start](#1-before-you-start)
2. [Run the deployment](#2-run-the-deployment)
3. [Domains and DNS](#3-domains-and-dns)
4. [Vercel](#4-vercel)
5. [Migrations](#5-migrations)
6. [Verify](#6-verify)
7. [Roll back](#7-roll-back)
8. [Tear down](#8-tear-down)
9. [Current deployment](#9-current-deployment)
10. [Known gaps](#10-known-gaps)

## 1. Before you start

Log in and select the project:

```bash
gcloud auth login                              # opens a browser
gcloud auth application-default login          # for tools that use ADC
gcloud config set project <PROJECT_ID>
vercel login                                   # or: bunx vercel login
# Only for BUILD_MODE=local: Docker must be running. 07-build-push.sh runs `gcloud auth configure-docker`.
```

You need:

- `gcloud` (recent), `openssl`, and `bash` (Git Bash or WSL on Windows)
- the `vercel` CLI
- billing enabled on the project
- Owner (or equivalent) on the project
- a domain whose DNS you control

Every GCP script:

- requires `PROJECT_ID`, `REGION`, and `DOMAIN` in the environment
- aborts if `gcloud config get-value project` differs from `PROJECT_ID`
- prints its plan and does nothing unless `CONFIRM=yes` is set

Set the variables once, and keep `IMAGE_TAG` the same for steps 7 to 10:

```bash
export PROJECT_ID=my-project REGION=asia-south1 DOMAIN=example.com
export IMAGE_TAG=$(git rev-parse --short HEAD)
```

## 2. Run the deployment

Run the steps in order. Each one depends on the previous ones.

| # | Script | What it does | Notes |
|---|--------|--------------|-------|
| 1 | `deploy/gcp/01-apis.sh` | Enables the APIs | |
| 2 | `deploy/gcp/02-network.sh` | Creates the VPC, subnet, and Private Service Access range with peering | Direct VPC egress uses the subnet. No NAT is created. |
| 3 | `deploy/gcp/03-artifact-registry.sh` | Creates the Docker repository `sqlflow` | |
| 4 | `deploy/gcp/04-cloudsql.sh` | Creates `sqlflow-app` and `sqlflow-sandbox` (PG17, private IP only) | 10 to 20 minutes each. Billable as soon as they exist. Deletion protection is on. |
| 5 | `deploy/gcp/05-secrets.sh` | Creates Secret Manager secrets and database users, and builds connection URLs from private IPs | Never prints secret values. OAuth, Gemini, and metrics settings are optional inputs. |
| 6 | `deploy/gcp/06-iam.sh` | Creates service accounts and per-secret accessor bindings | The API service account cannot read sandbox secrets. |
| 7 | `deploy/gcp/07-build-push.sh` | Builds and pushes `sqlflow-api` and `sqlflow-worker` | `BUILD_MODE=cloudbuild` (default) or `local` |
| 8 | `deploy/gcp/08-migrate.sh` | Runs Cloud Run Jobs: creates the app database, runs `node-pg-migrate up`, applies the sandbox bootstrap SQL | Needs the images from step 7 |
| 9 | `deploy/gcp/09-deploy-api.sh` | Deploys the Cloud Run service `sqlflow-api` | Map `api.<domain>` afterwards (section 3) |
| 10 | `deploy/gcp/10-deploy-worker.sh` | Deploys the Cloud Run worker pool | Fallback: GCE instructions |
| 11 | `deploy/gcp/11-scheduler.sh` | Creates the daily cleanup and the 10-minute sweep | If you use the OIDC option, rerun `06-iam.sh` after step 9 |
| 12 | `deploy/gcp/12-monitoring.sh` | Creates an uptime check on `/health` and alert policies | Needs `ALERT_EMAIL` |
| 13 | `deploy/vercel/deploy.sh` | Links the project, sets `NEXT_PUBLIC_API_URL`, deploys | See [section 4](#4-vercel) |

A full run looks like this:

```bash
CONFIRM=yes deploy/gcp/01-apis.sh
CONFIRM=yes deploy/gcp/02-network.sh
CONFIRM=yes deploy/gcp/03-artifact-registry.sh
CONFIRM=yes deploy/gcp/04-cloudsql.sh
# Optional OAuth and AI keys:
# export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... GOOGLE_GENERATIVE_AI_API_KEY=...
CONFIRM=yes deploy/gcp/05-secrets.sh
CONFIRM=yes deploy/gcp/06-iam.sh
CONFIRM=yes deploy/gcp/07-build-push.sh
CONFIRM=yes deploy/gcp/08-migrate.sh
CONFIRM=yes deploy/gcp/09-deploy-api.sh
CONFIRM=yes deploy/gcp/10-deploy-worker.sh
CONFIRM=yes deploy/gcp/11-scheduler.sh
ALERT_EMAIL=you@example.com CONFIRM=yes deploy/gcp/12-monitoring.sh
CONFIRM=yes PROD=yes deploy/vercel/deploy.sh
```

### Sizing defaults

Override these through the environment. The defaults live in `00-env.sh`.

| Resource | Default | Source |
|----------|---------|--------|
| API | 1 to 3 instances, concurrency 50, timeout 60 s, 1 CPU, 1 GiB | requirement |
| Worker | 2 instances, `WORKER_CONCURRENCY=4`, always-on CPU | requirement |
| `sqlflow-app` | `db-custom-2-7680`, ZONAL, 20 GB SSD, `max_connections=200`, PITR 7 days | assumption; measure |
| `sqlflow-sandbox` | `db-custom-4-15360`, ZONAL, 20 GB SSD (auto-increase), `max_connections=400`, daily backup | assumption; measure |

**Connection budget.** When you change sizes, check this:

- API pools, worker pools, and pg-boss together must stay under the app instance's `max_connections`.
- Each student role is limited to 3 connections. Sandbox peak is roughly `concurrent active students × 3`, plus the admin pools (`SANDBOX_ADMIN_POOL_MAX` × worker count).

## 3. Domains and DNS

| Host | Points to | Record | Where to get the value |
|------|-----------|--------|------------------------|
| `api.<domain>` | Cloud Run `sqlflow-api` | Usually `CNAME ghs.googlehosted.com.` | `gcloud beta run domain-mappings describe --domain api.<domain> --region <REGION>` prints the exact records. Set `MAP_DOMAIN=yes` for `09-deploy-api.sh` to create the mapping. |
| `app.<domain>` | Vercel | `CNAME cname.vercel-dns.com.` (Vercel may show a project-specific value; use that one if it differs) | Vercel dashboard, then your project, then Domains |

Things to know:

- Cloud Run domain mappings are a preview feature with regional limits. The Google account
  that verifies the domain must own it in Search Console. For production, prefer a global external
  Application Load Balancer with a serverless NEG. That isn't scripted here. Check the region support
  yourself (UNVERIFIED).
- **Cookies.** The API sets `COOKIE_DOMAIN=.<domain>`, so a session cookie issued by `api.<domain>` is
  first-party for `app.<domain>` (same site). Better Auth's `trustedOrigins` comes from `CORS_ORIGIN`,
  which accepts a comma-separated list.
- **OAuth callbacks.** Register these with the providers:
  `https://api.<domain>/auth/callback/google` and `https://api.<domain>/auth/callback/github`.

## 4. Vercel

Set these once in the Vercel dashboard:

- **Root Directory:** `apps/web`
- **Include source files outside of the Root Directory in the Build Step:** enabled. The app imports `packages/*`.
- **Install command:** `bun install` (detected from `bun.lock`)

`NEXT_PUBLIC_API_URL` is inlined at build time, so changing it requires a redeploy.

`deploy/vercel/deploy.sh` runs from the repo root. It runs `vercel link`, sets the variable for production
and preview, adds the domain, and deploys. Without `PROD=yes` it makes a preview. With it, it runs `vercel --prod`.

## 5. Migrations

- **`node-pg-migrate` is the only migration system.** Its migrations live in `apps/api/migrations`.
  Run `08-migrate.sh STEPS=migrate` once per release, before you deploy the new API revision. It runs
  `node_modules/.bin/node-pg-migrate -d POSTGRES_URL up` as a Cloud Run Job inside the VPC.
- **Prisma is for client generation only.** `prisma generate` runs at image build. Never run
  `prisma migrate` or `db push` against production.
- **The sandbox instance has no migrations.** The worker creates databases and roles at runtime. The
  one-time `deploy/sql/sandbox-bootstrap.sql` is applied by `08-migrate.sh`, and it is idempotent.
- **Keep migrations backward-compatible** with the previous API revision: expand, deploy, then contract.
  That keeps rollback safe.
- **Open issue.** `1700000000002_sandbox_runner_role.cjs` currently requires `SANDBOX_DB_PASSWORD`, and the
  migrate job does not set it. That migration belongs to the old shared-role design and should be removed
  or neutralised. Verify this before the next release.

## 6. Verify

After a deploy, check the service:

```bash
curl -fsS https://api.<domain>/livez
curl -fsS https://api.<domain>/health            # database and queue
gcloud run jobs executions list --job=sqlflow-migrate --region=$REGION
gcloud scheduler jobs run sqlflow-cleanup-sweep --location=$REGION
node loadtest/run.mjs --base https://api.<domain> --origin https://app.<domain> --stages 10 --stage-seconds 30
```

**Cleanup authentication.** `POST /cleanup/perform` needs the header `x-cleanup-authorization: <CLEANUP_TOKEN>`.
Cloud Scheduler stores that header in the job definition, so anyone who can read the job can read the token.

An OIDC option, without the header, is available: attach `--oidc-service-account-email=sqlflow-scheduler@...`
to the scheduler jobs. It only helps if the cleanup route sits behind Cloud Run IAM (a private service), or if
the app verifies the Google ID token. Today the route requires the header, and the API service is public.

## 7. Roll back

| Layer | How to roll back |
|-------|------------------|
| API | `gcloud run revisions list --service sqlflow-api --region $REGION`, then `gcloud run services update-traffic sqlflow-api --to-revisions=<REV>=100 --region $REGION` |
| Worker | Redeploy the previous tag: `IMAGE_TAG=<old> CONFIRM=yes deploy/gcp/10-deploy-worker.sh` |
| Web | `vercel rollback`, or promote an earlier deployment in the dashboard |
| Schema | Prefer a forward fix. If the migration is reversible, run a down migration as a job: `gcloud run jobs update sqlflow-migrate --args=-d,POSTGRES_URL,down,1 --region $REGION`, then execute the job. |
| Data | Point-in-time clone: `gcloud sql instances clone sqlflow-app sqlflow-app-restore --point-in-time=<RFC3339 UTC>`. Repoint `sqlflow-postgres-url` and `sqlflow-database-url` to new secret versions, then redeploy the API and worker. |
| Sandbox | Disposable. Student databases are recreated from templates the next time a student initialises. If the instance is rebuilt, drop it and rerun `sandbox-bootstrap.sql`. |
| Secrets | `gcloud secrets versions disable <ver> --secret <name>`. Services pin `:latest`, so redeploy after adding a version. |

Two rotations have wide effects:

- Rotating `BETTER_AUTH_SECRET` signs everyone out.
- Rotating `SANDBOX_ROLE_SECRET` changes every derived student password. Roles are re-asserted with the new
  password at the next provisioning (UNVERIFIED path). Restart the worker and re-initialise the sandboxes.

## 8. Tear down

Instances have deletion protection. Turn it off before you delete one:

```bash
gcloud sql instances patch <name> --no-deletion-protection
```

This repository ships no teardown script on purpose.

## 9. Current deployment

Deployed to project `sqlflow-prod` in region `asia-south1` on **Starter** sizing. Last verified 2026-10-09.

| Piece | Value |
|---|---|
| Web | Vercel project `sqlflow-web`, https://sqlflow-web.vercel.app, Root Directory `apps/web` |
| API | Cloud Run `sqlflow-api`, 1 to 3 instances, concurrency 50, 1 CPU, 1 GiB, CPU throttled between requests |
| Worker | Cloud Run worker pool `sqlflow-worker`, 1 instance, `WORKER_CONCURRENCY=4` |
| Databases | Cloud SQL PG17 `sqlflow-app` and `sqlflow-sandbox`, both db-g1-small, private IP only |
| Cleanup | Cloud Scheduler `sqlflow-cleanup-daily` (03:00 UTC) and `sqlflow-cleanup-sweep` (every 10 minutes) |
| Images | `asia-south1-docker.pkg.dev/sqlflow-prod/sqlflow/{sqlflow-api,sqlflow-worker}:v2` |

### No custom domain

Without a custom domain, the web app (`*.vercel.app`) and the API (`*.run.app`) are different registrable
domains. The session cookie would then count as third-party and be blocked. The fix is for the Next.js app to
proxy the API (`apps/web/next.config.ts`):

- **Vercel environment:**
  - `API_ORIGIN=<Cloud Run URL>`
  - `NEXT_PUBLIC_API_URL=https://<web>/api`
  - `NEXT_PUBLIC_AUTH_URL=https://<web>`

  These names must be listed in `turbo.json` under `build.env`. Otherwise Turborepo strips them from the build.
- **API environment:** `BETTER_AUTH_URL` and `CORS_ORIGIN` are the web origin, and `COOKIE_DOMAIN` is unset:

  ```bash
  PUBLIC_AUTH_URL=https://<web> PUBLIC_CORS_ORIGIN=https://<web> COOKIE_DOMAIN_VALUE= API_CPU_ALWAYS=no deploy/gcp/09-deploy-api.sh
  ```

- **Scheduler** targets the Cloud Run URL:

  ```bash
  API_BASE_URL=<Cloud Run URL> deploy/gcp/11-scheduler.sh
  ```

With a real domain, unset `API_ORIGIN`, point `NEXT_PUBLIC_API_URL` at `https://api.<domain>`, and set `COOKIE_DOMAIN`.

### Lessons from the first deploy

- **Windows secrets.** `openssl rand` writes CRLF on Windows. `gen_secret` strips it. A stray `\r` in a
  database password breaks logins.
- **Git Bash path rewriting.** Git Bash rewrites `/livez` into `C:/Program Files/Git/livez`. Set:

  ```bash
  export MSYS2_ARG_CONV_EXCL="--startup-probe;--liveness-probe"
  ```

- **Worker pools.** `gcloud run worker-pools` needs `export CLOUDSDK_PYTHON_SITEPACKAGES=1` and `pip install grpcio`.
  `PORT` is reserved.
- **Cloud SQL is not a superuser.** The admin is `cloudsqlsuperuser`. It cannot name the `REPLICATION` or
  `BYPASSRLS` attributes in `ALTER ROLE`, and it cannot set `temp_file_limit` per role. The instance minimum for
  `temp_file_limit` is 1 GiB. Test sandbox changes against a non-superuser admin, not `postgres`.

## 10. Known gaps

- **Monitoring and alerting** (`12-monitoring.sh`) is not configured. It needs gcloud alpha and beta components
  and an alert email.
- **Social login** (Google and GitHub) and **AI hints** are disabled, because the secrets were not provided.
- **Better Auth's rate limiter** is in memory, per instance, and keyed by IP.
