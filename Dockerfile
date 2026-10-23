# syntax=docker.io/docker/dockerfile:1
#
# Single-image build: static frontend (public/) + Express API (server/).
# Build context: repo root. Used by both docker-compose and CapRover.
#
# CapRover builds with the tarball root as the context, so every COPY path
# below is relative to the repo root — never to the Dockerfile's directory.

# Node 24.22.1 — patched 24.x LTS line (matches the pinned version used by
# the sibling real-estate project). Pinned to the exact patch: `node:24-alpine`
# would float, and the point of the pin is to guarantee the CVE-2026-* fixes
# are present.
FROM node:24.22.1-alpine AS base
WORKDIR /app

# ---- deps: install production dependencies ----
FROM base AS deps
# The lockfile pins @img/sharp-linuxmusl-x64 (Alpine is musl), so the native
# image-optimisation binaries resolve for this base image. No --ignore-scripts
# here: sharp's platform binaries are optionalDependencies, and skipping
# lifecycle scripts is safe because sharp 0.35.x ships prebuilt binaries
# rather than compiling libvips from source.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runner: slim production image ----
FROM base AS runner
ENV NODE_ENV=production

# Run as a non-root user. `node` (uid 1000) already exists in the official
# image; give it ownership of the app dir so uploads can be written.
RUN chown -R node:node /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node db/ ./db/

# Uploads live outside the image so a redeploy does not lose the photos that
# the admin CMS uploaded. Mount a CapRover persistent volume here (see
# docs/deployment-caprover.md). When the volume is not mounted, this
# directory is simply part of the container's writable layer and uploads are
# lost on the next deploy — the app still works, it just starts empty.
RUN mkdir -p /app/data/uploads \
 && chown -R node:node /app/data

USER node

# CapRover proxies to the port configured in the app's "Container HTTP Port"
# setting. It does NOT inject a PORT env var, so the port is pinned here and
# the same value must be selected in the CapRover dashboard.
EXPOSE 3030
ENV PORT=3030 \
    UPLOAD_DIR=/app/data/uploads

# The app binds to 0.0.0.0 (not 127.0.0.1) so CapRover's nginx can reach
# it from outside the container.
#
# The migration runs first: it waits for Postgres to accept connections,
# applies the idempotent schema, and seeds the catalog ONLY when the database
# is empty. It never drops tables, so restarting the container is safe.
#
# The healthcheck uses 127.0.0.1 rather than "localhost": in Alpine,
# "localhost" resolves to ::1 (IPv6) first, but the app listens on IPv4
# 0.0.0.0 — the IPv6 attempt is refused and the check never passes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O- http://127.0.0.1:3030/api/health || exit 1

CMD ["sh", "-c", "node server/db/migrate.js && node server/index.js"]
