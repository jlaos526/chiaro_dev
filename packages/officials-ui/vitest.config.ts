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
      'react-native': 'react-native-web',
      // react-native-svg ships only a native-targeted entry (CJS layout the
      // Node ESM loader chokes on). Tests don't need real SVG rendering —
      // a thin stub gives us the same component API surface.
      'react-native-svg': resolve(__dirname, './test/stubs/react-native-svg.tsx'),
    },
  },
})
