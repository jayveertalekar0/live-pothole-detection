import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['ashamed-parking-easily.ngrok-free.dev'],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },

  // ⬇️ Increase proxy timeout to 10 minutes (600 seconds)
  experimental: {
    proxyTimeout: 600_000,
  },
};

export default nextConfig;