import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Never silently ship type errors.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
