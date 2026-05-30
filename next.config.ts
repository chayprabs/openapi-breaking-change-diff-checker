import type { NextConfig } from "next";
import { getAppSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        headers: getAppSecurityHeaders(),
        source: "/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/tools/openapi-diff-breaking-changes",
        destination: "/",
        permanent: true,
      },
      {
        source: "/tools/:path*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/about",
        destination: "/",
        permanent: false,
      },
      {
        source: "/docs",
        destination: "/",
        permanent: false,
      },
      {
        source: "/login",
        destination: "/",
        permanent: false,
      },
      {
        source: "/account",
        destination: "/",
        permanent: false,
      },
      {
        source: "/dev/:path*",
        destination: "/",
        permanent: false,
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
