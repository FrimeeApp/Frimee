import path from "node:path";
import type { NextConfig } from "next";

// Use static export only for Capacitor mobile builds.
// Run with: BUILD_TARGET=capacitor next build
// Regular dev/web builds keep API routes fully functional.
const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: "export",
    trailingSlash: true,
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
    ],
  },
};

export default nextConfig;
