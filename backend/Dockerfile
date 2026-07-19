# syntax=docker/dockerfile:1
#
# Production image for the Aegis AI backend (Node/Express, run via tsx).
# The app executes TypeScript directly through tsx (no compiled dist/), so the
# runtime needs the module graph including tsx. We install everything and
# generate the Prisma client in a builder stage, then copy node_modules into a
# non-root runtime. Build context is backend/.

# ── builder: install all deps + generate the Prisma client ───────────────────
FROM node:20-slim AS builder
WORKDIR /app
# openssl is required by Prisma's query engine at generate + runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ── runner: non-root runtime ─────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
# Copy the already-installed modules (incl. tsx + the generated Prisma client)
# from the builder so the runtime needs no network install.
COPY --from=builder /app/node_modules ./node_modules
# Application source (.dockerignore keeps local node_modules / dev.db / tests out).
COPY . .
# multer writes uploads here; ensure it exists and is owned by the non-root user.
RUN mkdir -p src/uploads && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# `npm start` -> `tsx src/server.ts`
CMD ["npm", "start"]
