import { defineConfig, devices } from '@playwright/test'

/**
 * Slice 83 (audit U8): E2E against a production `next start` + the LOCAL
 * Supabase stack (spec D1). The runner does NOT boot servers — CI's e2e job
 * (and a local operator) starts Supabase, the served Edge Function, and
 * `next start` first; `E2E_BASE_URL` points here at it (default :3000).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // The 3 journeys share one seeded DB but create per-run users — safe in
  // parallel; keep 2 workers so CI runners aren't oversubscribed.
  workers: 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: './e2e-artifacts/test-output',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
})
