import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
