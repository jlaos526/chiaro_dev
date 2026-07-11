import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000, // GeocodIO + DB writes need headroom
    hookTimeout: 30_000,
  },
})
