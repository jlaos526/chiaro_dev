import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/seed/**/*.test.ts'],
    // Slice 63 (audit U10): fail fast with one actionable error when local
    // Supabase isn't running, instead of hundreds of connection failures.
    globalSetup: ['./test-global-setup.ts'],
    // Ingest scenarios run against a populated districts table (~42k rows
    // after TIGER seed). Each ~540-member upsert exercises FK + check
    // constraints; sequential round-trips stretch the wallclock.
    testTimeout: 60_000,
    // All seed tests write to the same local Postgres (port 54322). Running
    // files in parallel produces deadlocks on shared rows in `officials` /
    // `official_metrics`. Serialize file execution — the only safe option
    // for tests that share a single mutable database.
    fileParallelism: false,
  },
})
