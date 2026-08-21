import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sql-learn/types", "@sql-learn/ui"],
};

export default nextConfig;
