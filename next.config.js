/** @type {import('next').NextConfig} */

// Security headers applied to every response from the Next.js frontend.
// The Express backend already applies its own headers via helmet.
const securityHeaders = [
  // Prevent clickjacking — blocks your app from being embedded in iframes
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Stop browsers guessing MIME types on responses
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Limit referrer info sent when navigating away
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Lock down browser APIs at the platform level
  // Note: camera=() blocks camera globally here; the QR scanner uses
  // getUserMedia() which is governed by the browser's own permission prompt,
  // not this header — so QR scanning still works fine.
  {
    key: 'Permissions-Policy',
    value: 'microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 1 year after first visit
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Content Security Policy — whitelist of exactly what the page can load.
  // Every domain your frontend actually touches is listed below.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",

      // Scripts: Next.js runtime needs unsafe-inline + unsafe-eval in dev;
      // blob: is needed for Web Workers (QR library)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",

      // Styles: Tailwind/Next.js inline styles + Google Fonts stylesheet
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // Fonts: local + Google Fonts files
      "font-src 'self' data: https://fonts.gstatic.com",

      // Images: data URIs (QR canvas export) + blob URIs
      "img-src 'self' data: blob: https:",

      // Fetch/XHR — every API endpoint the frontend calls:
      // - own backend (nimagent.online)
      // - CoinGecko price feed (direct fallback in balance.ts)
      // - Exchange rate API (currency conversion)
      // - Nimiq RPC nodes (balance lookups)
      // - Nimiq Watch REST API (balance fallback)
      // - Nimiq Pay mini-app SDK WebSocket
      "connect-src 'self' https://nimagent.online https://api.coingecko.com https://api.exchangerate-api.com https://rpc.nimiqwatch.com https://api.nimiq.watch wss://*.nimiq.com https://*.nimiq.com",

      // Camera stream for QR scanner
      "media-src 'self'",

      // Web Workers (QR decode library uses blob: workers)
      "worker-src 'self' blob:",

      // No Flash/plugins ever
      "object-src 'none'",

      // Upgrade any stray HTTP sub-resource requests to HTTPS
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
