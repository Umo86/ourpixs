import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The venue / Partner plan was retired: one account subscription for everyone.
    return [
      { source: "/partners", destination: "/pricing", permanent: true },
      { source: "/partners/:path*", destination: "/pricing", permanent: true },
      { source: "/dashboard/partner", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
