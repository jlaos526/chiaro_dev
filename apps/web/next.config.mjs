import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Security headers (slice 71, audit C47). Notes:
// - NO Strict-Transport-Security here: Vercel injects it on *.vercel.app
//   (verified live 2026-07-11: max-age=63072000; includeSubDomains; preload).
//   Add it if the app ever moves to a host that doesn't.
// - CSP ships REPORT-ONLY first: RNW emits inline styles (style-src
//   'unsafe-inline') and Next's runtime uses inline scripts; tighten to an
//   enforced policy in a follow-up once the console stays quiet.
// - Permissions-Policy: web calibrate has NO browser-GPS path (GPS is
//   mobile-only, slice 39 follow-up), so geolocation is deniable.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
  // Compile officials-ui barrel imports down to direct module imports so
  // routes only carry the components they render (audit C2; pairs with the
  // package's sideEffects allowlist).
  experimental: {
    optimizePackageImports: ['@chiaro/officials-ui'],
  },
  transpilePackages: [
    '@chiaro/db',
    '@chiaro/profile',
    '@chiaro/supabase-client',
    '@chiaro/officials-ui',
    'react-native',
    'react-native-web',
    'react-native-svg',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'react-native$': 'react-native-web',
    }
    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...config.resolve.extensions,
    ]
    return config
  },
}

export default withSentryConfig(nextConfig, {
  org: 'chiaro',
  project: 'chiaro-web',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  // Proxy browser events through this origin so ad-blockers (which blocklist
  // *.sentry.io) don't drop the error-only telemetry (audit C51). The
  // middleware matcher excludes /monitoring so beacons skip auth entirely.
  tunnelRoute: '/monitoring',
  // Error-only config (tracesSampleRate: 0) never executes the tracing /
  // replay code paths — magic-comment tree-shake them out of the client
  // bundle (audit C0; chunk 930 was 116 kB gz on every route).
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
})
