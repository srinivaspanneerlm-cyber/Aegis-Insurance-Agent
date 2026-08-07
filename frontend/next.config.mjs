import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this directory.
  //
  // `frontend/` installs with npm and is deliberately outside the pnpm
  // workspace (see pnpm-workspace.yaml). Without this, Next walks up, finds the
  // repository's pnpm-lock.yaml, and infers the monorepo root — which would
  // trace `apps/`, `packages/` and `services/` into the standalone bundle and
  // emit it under `.next/standalone/frontend/` instead of at the top. This app
  // depends on nothing in the workspace, so its root is simply itself.
  //
  // The Docker build never saw this, because its context is `frontend/` alone.
  // A local `npm run build` did.
  outputFileTracingRoot: here,
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image runs Next without the full node_modules tree — a much smaller,
  // faster-starting image. `next dev` and `next start` are unaffected.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
