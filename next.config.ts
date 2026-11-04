import type { NextConfig } from "next";

const indexingAllowed = process.env.ALLOW_SEARCH_INDEXING === "true";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${process.env.LIVEKIT_URL ?? ""}`.trim(),
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    const h = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()" },
    ];
    // Suchmaschinen standardmäßig gesperrt (Wunsch des Betreibers). Freigabe nur über ALLOW_SEARCH_INDEXING=true.
    if (!indexingAllowed) h.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    return [{ source: "/:path*", headers: h }];
  },
};

export default config;
