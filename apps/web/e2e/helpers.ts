import { expect, type Page } from '@playwright/test'

/** Unique per-run credentials — a FRESH user per test keeps the slice-69
 * calibrate throttle (60s/user) from ever biting and needs no cleanup
 * (fixture DBs are disposable; local dev accumulates a few e2e users). */
export function freshUser(tag: string) {
  const n = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  return { email: `e2e-${tag}-${n}@example.com`, password: 'e2e-password-123' }
}

/** Sign up (local stack: confirmations OFF → immediate session) and
 * calibrate via the S79.5 sample-address affordance (SF City Hall — live
 * GeocodIO geocode landing inside the seeded fixture polygons). Ends on the
 * home page with the officials card rendered. */
export async function signUpAndCalibrate(page: Page, tag: string) {
  const user = freshUser(tag)
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByLabel('Confirm password').fill(user.password)
  await page.getByTestId('auth-submit').click()

  // Middleware bounces the fresh (uncalibrated) session to /calibrate.
  await page.waitForURL(/\/calibrate/, { timeout: 20_000 })
  await page.getByText(/try a sample address/i).click()

  // Successful calibration routes home; the live geocode can take a moment.
  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 })
  await expect(page.getByText('Your officials')).toBeVisible({ timeout: 20_000 })
  return user
}
