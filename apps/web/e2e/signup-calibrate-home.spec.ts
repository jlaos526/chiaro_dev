// Slice 83 (audit U8) — journey 1: signup → calibrate (sample address, live
// GeocodIO) → home renders the fixture delegation.
import { expect, test } from '@playwright/test'
import { signUpAndCalibrate } from './helpers'

test('signup → calibrate → home shows federal + state fixtures', async ({ page }) => {
  await signUpAndCalibrate(page, 'home')

  await expect(page.getByText('Harper Housefixture')).toBeVisible()
  await expect(page.getByText('Selby Senatefixture')).toBeVisible()
  // State officials render in their own home section (slice 5C).
  await expect(page.getByText('Avery Assemblyfixture')).toBeVisible()

  await page.screenshot({ path: 'e2e-artifacts/home.png', fullPage: true })
})
