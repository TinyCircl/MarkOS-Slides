# ============================================================
# Stage 1: Build @slidev/cli from local fork
# ============================================================
FROM node:22-bookworm-slim AS slidev-builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /slidev
COPY slidev/ ./

RUN pnpm install --frozen-lockfile

# Build in dependency order: types → parser → cli (@slidev/client has no build script)
RUN pnpm --filter "@slidev/types" run build && \
    pnpm --filter "@slidev/parser" run build && \
    pnpm --filter "@slidev/cli" run build

# ============================================================
# Stage 2: slidev-renderer (production image)
# ============================================================
FROM node:22-bookworm-slim

WORKDIR /app

COPY slidev-renderer/package.json slidev-renderer/package-lock.json ./

# Install all npm dependencies (includes @slidev/cli from npm registry)
RUN npm ci --include=optional

# Overwrite @slidev/cli dist with the locally optimized build
COPY --from=slidev-builder /slidev/packages/slidev/dist /app/node_modules/@slidev/cli/dist/

RUN npx playwright install --with-deps chromium

COPY slidev-renderer/src src

ENV NODE_ENV=production
ENV PORT=3210
ENV GRPC_PORT=50051

EXPOSE 3210
EXPOSE 50051

CMD ["node", "src/server.mjs"]
