import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom so the TanStack hooks test (renderHook) has a DOM. The schema +
    // integration suites run fine under jsdom too (matches @chiaro/officials).
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    testTimeout: 30_000,
    // Reset vi.spyOn mocks between tests so a leaked spy doesn't leak into
    // sibling files (vitest runs all test files in one worker by default).
    restoreMocks: true,
  },
})
