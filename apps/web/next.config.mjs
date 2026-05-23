import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
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
})
