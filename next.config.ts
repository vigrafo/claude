import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    const h = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()" },
    ];
    // CSP und X-Robots-Tag setzt die Middleware zur Laufzeit (src/middleware.ts).
    return [{ source: "/:path*", headers: h }];
  },
};

export default config;
