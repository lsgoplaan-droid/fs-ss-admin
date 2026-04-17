import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true, // enables src/instrumentation.ts for startup checks
  },
  images: {
    remotePatterns: [
      // Add tenant logo/favicon domains here as they are configured
    ],
  },
};

export default nextConfig;
