import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Use static export only for Capacitor mobile builds.
// Run with: BUILD_TARGET=capacitor next build
// Regular dev/web builds keep API routes fully functional.
const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const isDockerBuild = process.env.BUILD_TARGET === "docker";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: "export",
    trailingSlash: true,
  }),
  ...(isDockerBuild && {
    output: "standalone",
  }),
  turbopack: {
    root: path.resolve(__dirname),
  },
  reactStrictMode: false,
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
  // Don't instrument static Capacitor builds
  autoInstrumentServerFunctions: !isCapacitorBuild,
  autoInstrumentMiddleware: !isCapacitorBuild,
});
