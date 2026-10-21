import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dish photo uploads go through Server Actions (Vercel caps bodies at 4.5 MB).
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
