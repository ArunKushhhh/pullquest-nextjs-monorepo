FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build --filter=@pullquest/shared --filter=@pullquest/database --filter=@pullquest/web

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/web ./apps/web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "run", "start"]
