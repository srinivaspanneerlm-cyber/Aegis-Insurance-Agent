# syntax=docker/dockerfile:1
#
# Production image for the Aegis AI frontend (Next.js, standalone output).
# Multi-stage: install deps → build → copy only the standalone server + static
# assets into a minimal, non-root runtime. Build context is frontend/.

# ── deps: install node_modules from a clean lockfile ─────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder: compile the Next standalone bundle ──────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so the
# public API base must be supplied here. Default matches the dev fallback; in
# production pass the real edge URL, e.g. --build-arg NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_API_URL="http://localhost:5000/api"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner: minimal non-root runtime ─────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone output already bundles a minimal node_modules + server.js.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Run as the image's built-in unprivileged user.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
