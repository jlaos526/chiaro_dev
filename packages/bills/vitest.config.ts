import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    testTimeout: 15_000,
    // Reset vi.spyOn mocks between tests so a leaked spy doesn't leak into
    // sibling files (vitest runs all test files in one worker by default).
    restoreMocks: true,
  },
})
