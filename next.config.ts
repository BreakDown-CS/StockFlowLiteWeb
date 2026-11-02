import type { NextConfig } from 'next';

/**
 * Baseline security headers.
 *
 * NOTE: a full Content-Security-Policy is intentionally deferred to Phase F7.
 * Ant Design injects runtime <style> tags (CSS-in-JS) and Next injects bootstrap
 * scripts, so a nonce-based CSP must be designed and tested together with the
 * antd registry integration. Shipping a half-tested CSP here would either break
 * the app or give a false sense of protection.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
