import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@sql-learn/types", "@sql-learn/ui"],
  async rewrites() {
    if (!apiOrigin) return [];
    return [
      { source: "/auth/:path*", destination: `${apiOrigin}/auth/:path*` },
      { source: "/api/:path*", destination: `${apiOrigin}/:path*` },
    ];
  },
};

export default nextConfig;
