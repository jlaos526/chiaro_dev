import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15_000,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'react-native': 'react-native-web',
      // react-native-svg ships only a native-targeted entry (CJS layout the
      // Node ESM loader chokes on). Tests don't need real SVG rendering —
      // mirror the stub used by @chiaro/officials-ui's own vitest config so
      // web suites that import from the package barrel transitively don't
      // pull the real native module.
      'react-native-svg': resolve(
        __dirname,
        '../../packages/officials-ui/test/stubs/react-native-svg.tsx',
      ),
    },
  },
})
