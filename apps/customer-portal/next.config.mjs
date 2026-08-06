/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The workspace packages ship TypeScript source rather than a build artefact,
  // so Next compiles them as if they were part of this app. That is what removes
  // the build-orchestration step: editing a component in `@aegis/ui` hot-reloads
  // here immediately, with no watch task in between.
  transpilePackages: [
    "@aegis/ui",
    "@aegis/intelligence",
    "@aegis/design-system",
    "@aegis/utils",
    "@aegis/auth",
    "@aegis/shared-types",
  ],

  eslint: {
    // Linting runs as its own workspace task, so it does not also gate `build`.
    ignoreDuringBuilds: true,
  },

  // Never announce the framework version to an attacker.
  poweredByHeader: false,
};

export default nextConfig;
