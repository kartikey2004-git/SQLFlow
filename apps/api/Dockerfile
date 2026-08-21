# Runs both the API server and the worker (see CMD override in
# docker-compose.yaml) from one image - they're the same codebase, just two
# different entrypoints (src/index.ts vs src/worker.ts).
#
# Two-stage build: dependencies are installed with Bun (this repo's package
# manager - bun.lock, workspace:* packages), but the app actually *runs*
# under Node via tsx, not Bun - see packages/database's comments and
# research/IMPLEMENTATION_AUDIT_2026-08-21.md's Phase 1 log for why
# (a native-addon dependency segfaulted under Bun's own runtime even though
# `bun install` pulled it fine; the project standardized on Node+tsx for
# actually running the app). Built from the monorepo root context so
# workspace:* packages resolve.

FROM oven/bun:1.3.3-alpine AS deps
WORKDIR /repo
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages
# --production would drop tsx (a devDependency) - it's this repo's actual
# runtime mechanism, not just a dev tool, so it must stay installed.
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# prisma.config.ts reads DIRECT_URL at config-load time (even for `prisma
# generate`, which only introspects schema.prisma and never actually
# connects) - a placeholder is enough to satisfy it during the image build;
# the real DATABASE_URL/DIRECT_URL used at runtime comes from the
# container's env (see docker-compose.yaml), not from anything baked into
# this image.
RUN cd packages/database && DIRECT_URL="postgres://build:build@localhost:5432/build" bun run db:generate

FROM node:22-alpine AS runtime
# addgroup/adduser are busybox builtins (no apk/network fetch needed) - a
# non-root user for the actual process.
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build --chown=app:app /repo /repo
USER app
ENV NODE_ENV=production
WORKDIR /repo/apps/api
CMD ["node_modules/.bin/tsx", "src/index.ts"]
