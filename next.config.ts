import type { NextConfig } from "next";

const proxyOrigin = process.env.VERCEL === "1" || process.env.API_PROXY_DISABLED === "true" ? undefined : process.env.API_PROXY_ORIGIN?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!proxyOrigin) return [];
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${proxyOrigin}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
