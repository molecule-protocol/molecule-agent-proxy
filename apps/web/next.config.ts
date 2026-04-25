import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Workspace package shipped as TypeScript source (no dist; not yet on npm).
  // Tell Next.js to transpile it through SWC during build.
  transpilePackages: ["@molecule/map-skill"],
};

export default nextConfig;
