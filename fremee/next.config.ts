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
  reactCompiler: true,
};

export default nextConfig;
