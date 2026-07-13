// Slice 83 (audit U8) — journey 2: home → federal detail page renders the h1
// + the S80 shell card h2s (SSR-prefetched per S79, so cards paint with data).
import { expect, test } from '@playwright/test'
import { signUpAndCalibrate } from './helpers'

test('officials detail renders bio h1 + card sections', async ({ page }) => {
  await signUpAndCalibrate(page, 'detail')

  await page.getByText('Harper Housefixture').first().click()
  await page.waitForURL(/\/officials\//, { timeout: 20_000 })

  await expect(page.getByRole('heading', { level: 1, name: /Harper Housefixture/ })).toBeVisible({
    timeout: 20_000,
  })
  // Two S80 DetailCardShell h2s — one data-bearing (Issue Positions has the
  // seeded rating), one likely-empty (Service Record) — both must render.
  await expect(page.getByRole('heading', { level: 2, name: /Issue Positions/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /Service Record/ })).toBeVisible()

  await page.screenshot({ path: 'e2e-artifacts/officials-detail.png', fullPage: true })
})
