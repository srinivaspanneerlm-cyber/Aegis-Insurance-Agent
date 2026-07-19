/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image runs Next without the full node_modules tree — a much smaller,
  // faster-starting image. `next dev` and `next start` are unaffected.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
