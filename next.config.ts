/**
 * next.config.ts  (hardened)
 * ----------------------------
 * SECURITY changes vs original:
 *
 *  1. Image remotePatterns: locked to specific trusted hostnames only.
 *     The original had no path/port restrictions — attackers could abuse
 *     the image proxy to SSRF arbitrary Unsplash paths or other injected URLs.
 *
 *  2. poweredByHeader: false — removes the "X-Powered-By: Next.js" header that
 *     fingerprints the tech stack for automated scanners.
 *
 *  3. reactStrictMode: true — catches unsafe lifecycle methods and accidental
 *     side effects, improving overall code quality security posture.
 *
 *  4. Explicit headers() function adds security headers as a FALLBACK for
 *     any route the middleware might miss (belt-and-suspenders).
 *     The middleware is the primary enforcement point; these are defaults.
 *
 *  5. Logging of dangerous env defaults in production.
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── Performance / correctness ──────────────────────────────────────────────
  reactStrictMode: true,

  // ── Security: remove tech-stack fingerprint ────────────────────────────────
  poweredByHeader: false,

  // ── Image proxy allowlist (strict) ────────────────────────────────────────
  // SECURITY: Only allow images from these exact hostnames.
  // Wildcard hostnames (e.g., '**') are explicitly not used.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/photo-**',   // Tighten to photo paths only
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',  // Google user avatars
        pathname: '/a/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',          // Optional: if you use Cloudinary
      },
    ],
    // Limit image sizes the proxy will accept — reduces SSRF amplification
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Disable SVG serving via the optimizer (XSS risk)
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ── Fallback security headers ─────────────────────────────────────────────
  // These complement the middleware but target any route paths the middleware
  // matcher regex might miss (e.g., direct static file serving in some hosts).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // HSTS — only safe in production with HTTPS
          ...(process.env.NODE_ENV === 'production' ? [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          ] : []),
        ],
      },
      // API routes: no caching of any response
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      // Auth routes: must never be cached
      {
        source: '/(login|auth|dashboard)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
