# SQL Learn Web

Next.js 16 (App Router) frontend for the SQL learning platform. It covers the
marketing landing page, sign-in and sign-up, the assignment list, the SQL
editor with run and grade, and account settings.

The app has no database access of its own. Everything goes through the
Express API in `../api`, and the API is the only place that runs SQL.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4 with shared styles from `@sql-learn/ui` and `@sql-learn/config-tailwind`
- Monaco editor (`@monaco-editor/react`), loaded client-side only
- TanStack Query for run and grade state
- Better Auth React client for sessions

## Routes

| Path | What it is |
|---|---|
| `/` | Marketing landing page (`src/app/(marketing)/`) |
| `/login`, `/register` | Email and password sign-in and sign-up, plus any social providers the API has enabled |
| `/assignments` | Published assignments |
| `/assignments/[id]` | Question, schema, editor, Run, Submit, and hints |
| `/settings/account`, `/settings/connections`, `/settings/sessions` | Account settings |

## Setup

From the repo root:

```bash
bun install
```

Copy `.env.example` to `.env.local`. For local development the defaults are enough:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the API and worker from `../api` (see that README), then:

```bash
bun run dev   # from apps/web
```

Open http://localhost:3000. The API's `CORS_ORIGIN` must be `http://localhost:3000`.

## Scripts

| Script | Command |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` (after a build) |
| `lint` | `eslint` |
| `typecheck` | `tsc --noEmit` |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes in production | The API's public origin. Inlined at build time, so changing it needs a rebuild. Production builds fail without it. Development falls back to `http://localhost:5000`. |
| `NEXT_PUBLIC_AUTH_URL` | No | Auth origin. Defaults to `NEXT_PUBLIC_API_URL`. |
| `API_ORIGIN` | No | Server-side API origin for the proxy below. Only set when proxying. |

`NODE_ENV` is set by Next.js and Vercel. Don't set it yourself.

The `build` task in the root `turbo.json` lists all three variables, so
Turborepo passes them through to the build.

## How the API is reached

Browsers send session cookies with requests to the API, so the API and the web
app have to be on the same site for those cookies to work.

- **Custom domain** (recommended): serve the web app at `app.<domain>` and the
  API at `api.<domain>`. Set `NEXT_PUBLIC_API_URL=https://api.<domain>` and leave
  `API_ORIGIN` unset.
- **No custom domain**: `*.vercel.app` and `*.run.app` are different sites, so
  cookies would be blocked. Set `API_ORIGIN` to the API's Cloud Run URL and
  `NEXT_PUBLIC_API_URL` to `https://<web-origin>/api`. `next.config.ts` then
  rewrites `/auth/*` and `/api/*` to the API, and the browser only sees the web
  origin.

## Deploying to Vercel

This app is deployed as the Vercel project `sqlflow-web`. The deployment steps are in
[`../../deploy/README.md`](../../deploy/README.md). The notable settings:

- Root directory: `apps/web`
- Include source files outside the root directory in the build: enabled, because the app imports `packages/*`
- Set the environment variables above for the Production environment before building

## Project layout

- `src/app/`: routes and layouts (App Router)
- `src/app/(marketing)/`: landing page content and effects
- `src/components/`: shared UI, including the SQL editor
- `src/context/`: auth and query providers
- `src/lib/`: config (`config.ts`) and the Better Auth client (`auth-client.ts`)
- `src/services/`: typed fetch wrappers for the API (assignments, sandbox jobs, hints, progress)
- `next.config.ts`: API proxy rewrites
