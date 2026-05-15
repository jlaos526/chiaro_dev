import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/seed/**/*.test.ts'],
    // Ingest scenarios run against a populated districts table (~42k rows
    // after TIGER seed). Each ~540-member upsert exercises FK + check
    // constraints; sequential round-trips stretch the wallclock.
    testTimeout: 60_000,
  },
})
