import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Use static export only for Capacitor mobile builds.
// Run with: BUILD_TARGET=capacitor next build
// Regular dev/web builds keep API routes fully functional.
const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const isDockerBuild = process.env.BUILD_TARGET === "docker";

const allowedDevOrigins = [process.env.CAP_ALLOWED_DEV_ORIGIN].filter(
  (origin): origin is string => Boolean(origin)
);

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
  ...(allowedDevOrigins.length > 0 && {
    allowedDevOrigins,
  }),
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
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    // Don't instrument static Capacitor builds.
    autoInstrumentServerFunctions: !isCapacitorBuild,
    autoInstrumentMiddleware: !isCapacitorBuild,
  },
});
