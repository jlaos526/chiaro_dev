import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/seed/**/*.test.ts'],
    testTimeout: 20_000,
  },
})
