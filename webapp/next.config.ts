import type { NextConfig } from "next";

// CSP is production-only: Turbopack's dev-mode HMR relies on eval + a
// websocket connection that a strict policy would otherwise have to special
// case, and this header only matters for what real users actually hit.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.hcaptcha.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.hcaptcha.com",
  "frame-src https://*.hcaptcha.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Content-Security-Policy", value: csp });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
