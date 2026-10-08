# syntax=docker/dockerfile:1

FROM oven/bun:1.3.3-alpine AS deps
WORKDIR /repo
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN cd packages/database && DIRECT_URL="postgres://build:build@localhost:5432/build" bun run db:generate

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini \
 && addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build --chown=app:app /repo/package.json /repo/bun.lock ./
COPY --from=build --chown=app:app /repo/node_modules ./node_modules
COPY --from=build --chown=app:app /repo/packages ./packages
COPY --from=build --chown=app:app /repo/apps/api ./apps/api
USER app
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /repo/apps/api
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node_modules/.bin/tsx", "src/index.ts"]
