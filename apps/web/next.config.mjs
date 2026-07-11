import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
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
      '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
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
