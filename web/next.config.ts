import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (web/Dockerfile).
  output: "standalone",
};

export default nextConfig;
